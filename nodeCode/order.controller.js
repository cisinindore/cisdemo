var stripe_config = require('../config/stripe');
var stripe = require("stripe")(stripe_config.secret_key);
var mongoose = require('mongoose');
const { to, ReS, ReE, ValidationErrors, TE } = require('../services/util.service');
var ObjectId = require('mongoose').Types.ObjectId;
var async = require("async");
const nodemailer = require("nodemailer");
var Request = require('request');
const smtpTransport = require('nodemailer-smtp-transport');
const Order = require("../models/Order.model");
const Cart = require("../models/Cart.model");
const Transection = require("../models/Transaction.model");
const OrderProduct = require("../models/OrderProducts.model");
//const Wallet = require("../models/Wallet.model");
const Coupon = require("../models/Coupon.model");
const Discount = require("../models/Discount.model");
const UserController = require("../controllers/user.controller");
const Shop = require("../models/Shop.model");
const User = require("../models/User.model");
const emails = require("../emails/email");
const { sendPushNotifications } = require('./firebase_notifications.controller');
const Notification = require("./pushnotifications/notification.controller.js");
const NodeGeocoder = require('node-geocoder');
const TaxSet = require("../models/TaxSetting.model.js")
const Product = require("../models/Product.model.js")
const DeliveryRatingReview = require("../models/DeliveryRatingReview.js");
// Function to obtain the token with card
const getToken = async function (req, res, body) {
    let err, token;

    [err, token] = await to(stripe.tokens.create({
        card: {
            number: body.cardNumber.trim(),
            exp_month: body.expMonth.trim(),
            exp_year: body.expYear.trim(),
            cvc: body.cvc.trim(),
            name: body.contactPerson,
            address_line1: body.street,
            address_line2: body.street,
            address_city: body.city,
            address_state: body.state,
            address_zip: body.zipcode,
            address_country: body.country
        }
    }));

    if (err) { return ReE(res, { msg: err.message }, 422); }
    return token;
}

/*
*  Payment Service Function To Do Payment
*/
const dopayment = async function (req, res, token, finalprice) {
    let payerr, charges, amountm;
    let postData = req.body;
    //postData.countryCode
    // [payerr, charges] = await to(stripe.charges.create({
    //   amount: Math.round(amount),
    //   currency: 'CAD',
    //   description: 'Product purchase',
    // //   source: token.id,
    //   customer : token.stripeCustomerId,
    //   card : token.stripeCardId
    // }));
    var country = '';
    var totalTax = 0;


    const options = {
        provider: 'google',
        apiKey: process.env.MAP_KEY,
        formatter: null
    };
    const geocoder = NodeGeocoder(options);
    //get tax settigns from databse
    [tErr, tRes] = await to(TaxSet.find({}));
    // Using callback ,
    if (postData.lat !== undefined && postData.lat !== undefined && postData.long !== undefined && postData.long) {
        const addresRes = await geocoder.reverse({ lat: postData.lat, lon: postData.long });
        if (addresRes !== undefined) {
            country = addresRes[0].countryCode;
            for (const taxes of tRes) {
                if (taxes.countryCode === country) {

                    if (taxes.taxType === 'flat') { totalTax = taxes.taxValue; }
                    if (taxes.taxType === 'percentage') { totalTax = (finalprice * taxes.taxValue) / 100; }
                    totalTax = parseFloat(totalTax.toFixed(2));
                }
            }
        }
    }



    amount = parseFloat(finalprice.toFixed(2));
    // console.log("-----amount send to pay---------", amount);
    let totalServiceCharge = 0;
    let codDelCharge = 0;
    //calculate service charge delivery charge etc
    if (amount > 0) {

        let serviceCharge = parseFloat(process.env.PERCENT_SERVICE_CHARGE_CUSTOMER_PAYS);
        let minServiceCharge = parseFloat(process.env.MIN_SERVICE_CHARGE_CUSTOMER_PAYS);
        let delPercCharge = parseFloat(process.env.PERCENT_OF_SERVICE_CHARGE_FOR_DELIVERY);
        let minDelCharge = parseFloat(process.env.MIN_DELIVERY_PAID);

        totalServiceCharge = (amount * serviceCharge) / 100;
        if (totalServiceCharge < minServiceCharge) { totalServiceCharge = minServiceCharge }
        totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));

        // if product is elf pickup, then delivery charge will be removed
        if (postData.purchaseType !== undefined && postData.purchaseType === "pickup") {
            totalServiceCharge = totalServiceCharge - ((totalServiceCharge * delPercCharge) / 100);
            totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));
        }

        amount = amount + totalServiceCharge + totalTax + codDelCharge;
        amount = parseFloat(amount.toFixed(2));
    }

    amount = amount * 100;
    amount = parseFloat(amount.toFixed(2));

    // console.log("-----amount after calculation---------", amount);
    
    [payerr, charges] = await to(stripe.paymentIntents.create(
        {
            amount: amount,
            currency: 'cad',
            payment_method_types: ['card'],
            description: 'Product purchase',
            confirm: true,
            customer: token.stripeCustomerId,
            payment_method: token.stripeCardId
        }
    ));


    if (payerr) { return ReE(res, { msg: payerr.message }, 422); }
    return charges;
}

const createOrderRemoveFromCart = async function (req, res, orderData, transectionId, elementId) {




    [pErr, pRes] = await to(Product.findOne({ _id: orderData.productId }));
    if (pRes && pRes !== undefined) {
        await to(Product.findOneAndUpdate({ _id: orderData.productId }, { $set: { inStock: pRes.inStock - orderData.quantity } }, { new: true }));
    }

    // create order
    [errO, resData] = await to(OrderProduct.create(orderData));
    if (errO) { return ReE(res, { msg: "error in processing your request" }, 422); }

    //add order id to transection
    if (transectionId !== 1) {
        [errT, trnData] = await to(Transection.findOneAndUpdate({ _id: transectionId }, { $push: { orderId: resData._id } }, { new: true }));
        if (errT) { return ReE(res, { msg: "error in processing your request" }, 422); }
    }


    //remove product from cart with individual cart row id
    [errC, crtData] = await to(Cart.deleteOne({ _id: elementId }));
    if (errC) { return ReE(res, { msg: "error in processing your request" }, 422); }

    if (crtData) { return resData._id; }
}

//this will send push notification to the user who placed order
const userOrderPlacedNotification = async function (req, res, userId, orderId) {
    [err, ress] = await to(User.findOne({ _id: userId, pushNotification: 1 }));
    if (err) { return ReE(res, { msg: "User find error", error: err }, 422); }
    if (ress.device_token !== undefined && ress.device_token) {
        sendPushNotifications(ress.device_token, { "click_action": "FLUTTER_NOTIFICATION_CLICK" }, { title: "Your order has been placed", body: "Check status" });
    }
}

//this will send push notification to the ddelivery boy that new order placed on app
const userOrderPlacedNotificationForDeliveryBoy = async function (req, res, userId, orderId) {
    [err, ress] = await to(User.find({ _id: { $ne: userId }, role_type: { $nin: ['shopkeeper', 'admin'] }, pushNotification: 1 }));
    if (err) { return ReE(res, { msg: "User find error", error: err }, 422); }
    if (ress !== undefined && ress.length > 0) {
        var userTokens = [];
        for (const user of ress) {
            if (user.device_token !== undefined && user.device_token !== null && user.device_token) {
                userTokens.push(user.device_token);
            }
        }
        if (userTokens.length > 0) {
            sendPushNotifications(userTokens, { "click_action": "FLUTTER_NOTIFICATION_CLICK" }, { title: "Order is being prepared", body: "Check status" });
        }
    }
}

// Insert order after payment
const insertOrder = async function (req, res, userId, transectionId, utensils, purchaseType) {

    const postData = req.body;
    const payload = req.decoded;
    //intializing a counter to check how many product order completion

    let successCounter = 0;
    let cartCounter = 0;
    var ordersToTransection = [];
    let orderTotalCost = 0;
    let childOrder = [];
   

    var address = {
        buildingName: postData.buildingName !== undefined && postData.buildingName !== '' ? postData.buildingName : null,
        roomNumber: postData.roomNumber !== undefined && postData.roomNumber !== '' ? postData.roomNumber : null,
        lat: postData.lat !== undefined && postData.lat !== '' ? postData.lat : null,
        long: postData.long !== undefined && postData.long !== '' ? postData.long : null
    };


    let initOrder = {};
    initOrder.customerId = userId;
    initOrder.userOrderId = (Date.now().toString(18) + Math.random().toString(5)).replace('.', '').substring(0, 12).toUpperCase();
    initOrder.status = "pending";
    initOrder.paymentStatus = transectionId !== 1 ? "complete" : "pending";
    initOrder.paymentMode = transectionId !== 1 ? "card" : "cod";
    initOrder.purchaseType = purchaseType;
    initOrder.utensils = utensils === 1 ? "Yes" : "No";
    initOrder.orderNote = postData.note !== undefined && postData.note !== '' ? postData.note : null;
    initOrder.paymentAt = new Date();
    initOrder.createdAt = new Date();


    if (transectionId && transectionId !== '' && transectionId !== 1) { initOrder.transactionId = transectionId; }



    //loop through the cart data to process the order
    [err, orderCreate] = await to(Order.create(initOrder));
    Cart.find({ userId: userId }).lean().populate('userId').populate('productId').populate({
        path: 'addons',
        model: "Addons"
    }).then(async cartData => {
        cartCounter = cartData.length;
        for (const element of cartData) {
             var totalAddOnPrice = 0;
            [eErr, inactiveRes] = await to(User.findOne({ _id: element.productId.shopkeeperId, account_activate: { $ne: "active" } }));
            if (inactiveRes && inactiveRes !== undefined && inactiveRes._id && inactiveRes._id !== undefined) {
                return ReE(res, { msg: "Shop is not active anymore" }, 422);
            }
            if (element.productId.inStock !== undefined && element.productId.inStock < element.quantity) { if (element.productId.inStock === 0) { return ReE(res, { msg: element.productId.title + " is out of stock" }, 422); } else { return ReE(res, { msg: "Only " + element.productId.inStock + " quantity is available for " + element.productId.title }, 422); } }
            if (element.couponApplied !== undefined && element.couponApplied) { [eeee, rrr] = await to(Coupon.findOneAndUpdate({ _id: element.couponApplied }, { $push: { holdUsers: { $each: [payload._id] } } }, { new: true })); }
            let orderData = {};
            let payable_amount = 0;
            let addonsPrice = 0;
            let couponApplied = '';
            var priceAndCouponObj = {};

            orderData.quantity = element.quantity;
            orderData.orderId = orderCreate._id;


            var addonsObj = [];
            //addons price calculation
            if (element.addons !== undefined &&
                element.addons !== null &&
                element.addons.length > 0) {
                for (const addons of element.addons) {
                    if (addons.addonPrice !== undefined && addons.addonPrice) {
                        addonsPrice = addonsPrice + (parseFloat(addons.addonPrice));
                        addonsObj.push(addons);
                    }
                }
            }
            orderData.addons = addonsObj;

            if (element.productId.salePrice && element.productId.salePrice !== '') { payable_amount = (element.productId.salePrice) * element.quantity; }
            else { payable_amount = (element.productId.regularPrice) * element.quantity; }


            totalAddOnPrice = totalAddOnPrice + (parseFloat(addonsPrice*element.quantity));;
            //check if any discount is active on product
            if (element.productId.discountApplied !== undefined &&
                element.productId.discountApplied !== '' &&
                element.productId.discountApplied !== null) {
                var discountid = mongoose.Types.ObjectId(element.productId.discountApplied);

                [err, discRes] = await to(Discount.findOne({ _id: discountid }).then((response) => {
                    if (response) {
                        var date1 = new Date(response.expiry);
                        var date2 = new Date();
                        var Difference_In_Time = date1.getTime() - date2.getTime();
                        var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);


                        if (Difference_In_Days > 0 && response.status == "1") {
                            let product = element.productId;
                            if (response.discountType == "percentage") { payable_amount = (payable_amount - ((payable_amount * response.discountValue) / 100)); }
                            else if (response.discountType == "flat") { payable_amount = payable_amount - (response.discountValue * element.quantity); }
                            orderData.discountApplied = element.productId.discountApplied;
                        }
                    }
                }).catch(err => {
                    return ReE(res, { msg: "", errors: err }, 422);
                }));

            }


            var defaultAddres = 0;

            //hold merchant id in variable to store
            var merchantId = element.productId.shopkeeperId;

            //Creating the order object, this will get insert into child order collection
            orderData.customerId = userId;
            orderData.productId = element.productId._id;
            orderData.merchantUserId = merchantId;
            orderData.transactionId = transectionId !== 1 ? transectionId : null;
            orderData.total = parseFloat(payable_amount.toFixed(2));
            orderData.pricePerItem = element.productId.salePrice !== undefined && element.productId.salePrice ? element.productId.salePrice : element.productId.regularPrice;
            orderData.productNotes = element.productNotes;




            // count and caluculate the discount on total cart value
            if (element.couponApplied !== undefined && element.couponApplied !== '' && element.couponApplied !== null) {
                var coupId = mongoose.Types.ObjectId(element.couponApplied);
                await to(Coupon.findOne({ _id: coupId }).then(async (response) => {
                    if (response)
                    {
                        var date1 = new Date(response.expiry);
                        var date2 = new Date();
                        var Difference_In_Time = date1.getTime() - date2.getTime();
                        var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);

                        let price = 0;
                        if (element.productId.salePrice) { price = element.productId.salePrice; }
                        else if (element.productId.regularPrice) { price = element.productId.regularPrice; }
                        else { }
                        
                        if (Difference_In_Days > 0 &&
                            response.status == "active" &&
                            response.categories.indexOf(element.productId.categories) !== -1 &&
                            response.productMinPrice <= price*element.quantity)
                        {
                            console.log("----price in loop----",price);
                            if (response.shopkeeperId !== undefined && response.shopkeeperId !== null) 
                            {
                                let newShopkepr = mongoose.Types.ObjectId(response.shopkeeperId);                                
                                if (newShopkepr.equals(element.productId.shopkeeperId))
                                {
                                    if (response.couponType == "Percent") { orderData.total = payable_amount - ((payable_amount * response.couponValue) / 100); }
                                    else if (response.couponType == "flat") { orderData.total = payable_amount-response.couponValue;  }
                                    else { }
                                    orderData.couponApplied = element.couponApplied;
                                }
                            } else {
                                      if (response.couponType == "Percent") { orderData.total = payable_amount - ((payable_amount * response.couponValue) / 100); }
                                      else if (response.couponType == "flat") { orderData.total = payable_amount-response.couponValue; }
                                      else { }
                                      orderData.couponApplied = element.couponApplied;
                                   }
                        }
                    }


                    orderData.total = parseFloat(orderData.total.toFixed(2));                   
                    orderTotalCost = orderTotalCost + orderData.total + totalAddOnPrice;
                    //inserting order after payment
                    [err, resData] = await to(createOrderRemoveFromCart(req, res, orderData, transectionId, element._id));
                    if (resData) {
                        childOrder.push(resData);
                        successCounter = successCounter + 1;
                        if (successCounter === cartCounter) {
                            let totalServiceCharge = 0;
                            let deliveryCharge = 0;
                            let codDelCharge = 0;

                            if (orderTotalCost > 0) {
                                let serviceCharge = parseFloat(process.env.PERCENT_SERVICE_CHARGE_CUSTOMER_PAYS);
                                let minServiceCharge = parseFloat(process.env.MIN_SERVICE_CHARGE_CUSTOMER_PAYS);
                                let delPercCharge = parseFloat(process.env.PERCENT_OF_SERVICE_CHARGE_FOR_DELIVERY);
                                let minDelCharge = parseFloat(process.env.MIN_DELIVERY_PAID);

                                totalServiceCharge = (orderTotalCost * serviceCharge) / 100;
                                if (totalServiceCharge < minServiceCharge) { totalServiceCharge = minServiceCharge }
                                totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));

                                // if product is elf pickup, then delivery charge will be removed
                                if (postData.cod !== undefined && postData.cod === 1 && postData.purchaseType === "delivery") {
                                    totalServiceCharge = totalServiceCharge - ((totalServiceCharge * delPercCharge) / 100);
                                    totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));
                                }
                                else if (postData.cod !== undefined && postData.cod === 1 && postData.purchaseType === "pickup") {
                                    totalServiceCharge = totalServiceCharge - ((totalServiceCharge * delPercCharge) / 100);
                                    totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));
                                }
                                else if (postData.purchaseType !== undefined && postData.purchaseType === "pickup") {
                                    totalServiceCharge = totalServiceCharge - ((totalServiceCharge * delPercCharge) / 100);
                                    totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));
                                } else {
                                    deliveryCharge = (totalServiceCharge * delPercCharge) / 100;
                                    if (deliveryCharge < minDelCharge) { deliveryCharge = minDelCharge }
                                    deliveryCharge = parseFloat(deliveryCharge.toFixed(2));
                                }
                            }

                            //calculate tax
                            var country = '';
                            var totalTax = 0;
                            const options = {
                                provider: 'google',
                                apiKey: process.env.MAP_KEY,
                                formatter: null
                            };
                            const geocoder = NodeGeocoder(options);
                            //get tax settigns from databse
                            [tErr, tRes] = await to(TaxSet.find({}));
                            // Using callback ,
                            if (postData.lat !== undefined && postData.lat !== undefined && postData.long !== undefined && postData.long) {
                                const addresRes = await geocoder.reverse({ lat: postData.lat, lon: postData.long });
                                if (addresRes !== undefined) {
                                    country = addresRes[0].countryCode;
                                    for (const taxes of tRes) {
                                        if (taxes.countryCode === country) {
                                            if (taxes.taxType === 'flat') { totalTax = taxes.taxValue; }
                                            if (taxes.taxType === 'percentage') { totalTax = (orderTotalCost * taxes.taxValue) / 100; }
                                            totalTax = parseFloat(totalTax.toFixed(2));
                                        }
                                    }
                                }
                            }

                            //calculate delivery charge if order is cod+delivery
                            if (postData.cod !== undefined && postData.cod === 1 && postData.purchaseType === "delivery") {
                                let ownerId = mongoose.Types.ObjectId(element.shopkeeperId);
                                [shopErr, shopRes] = await to(Shop.findOne({ ownerId: ownerId }));
                                if (shopRes && shopRes !== undefined && shopRes.codDeliveryCharge !== undefined && shopRes.codDeliveryCharge > 0) {
                                    codDelCharge = shopRes.codDeliveryCharge;
                                }
                            }
                          
                            var finSave = orderTotalCost + totalServiceCharge + totalTax + codDelCharge;

                            await to(Order.findOneAndUpdate({ _id: orderCreate._id }, {
                                $set: {
                                    orderTotal: parseFloat(orderTotalCost.toFixed(2)),
                                    pricepaid: parseFloat(finSave.toFixed(2)),
                                    totalTax: parseFloat(totalTax.toFixed(2)),
                                    address: address,
                                    childOrder: childOrder,
                                    merchantUserId: merchantId,
                                    serviceCharge: totalServiceCharge,
                                    deliveryCharge: deliveryCharge,
                                    codDeliveryCharge: codDelCharge
                                }
                            }));

                            await to(emails.orderPlacedNotification(req, res, orderCreate._id));
                            await to(userOrderPlacedNotification(req, res, userId, orderCreate._id));
                            //await to(userOrderPlacedNotificationForDeliveryBoy(req, res, userId, orderCreate._id));
                            return ReS(res, { msg: "Order placed." }, 200);
                        }
                    }
                }));

            } else {
               
                orderTotalCost = orderTotalCost + orderData.total+totalAddOnPrice;
                //inserting order after payment
                [err, resData] = await to(createOrderRemoveFromCart(req, res, orderData, transectionId, element._id));
                if (resData) {
                    childOrder.push(resData);
                    successCounter = successCounter + 1;
                    if (successCounter === cartCounter) {

                        let totalServiceCharge = 0;
                        let deliveryCharge = 0;
                        let codDelCharge = 0;

                        if (orderTotalCost > 0) {
                            let serviceCharge = parseFloat(process.env.PERCENT_SERVICE_CHARGE_CUSTOMER_PAYS);
                            let minServiceCharge = parseFloat(process.env.MIN_SERVICE_CHARGE_CUSTOMER_PAYS);
                            let delPercCharge = parseFloat(process.env.PERCENT_OF_SERVICE_CHARGE_FOR_DELIVERY);
                            let minDelCharge = parseFloat(process.env.MIN_DELIVERY_PAID);

                            totalServiceCharge = (orderTotalCost * serviceCharge) / 100;
                            if (totalServiceCharge < minServiceCharge) { totalServiceCharge = minServiceCharge }
                            totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));

                            // if product is elf pickup, then delivery charge will be removed
                            if (postData.cod !== undefined && postData.cod === 1 && postData.purchaseType === "delivery") {
                                totalServiceCharge = totalServiceCharge - ((totalServiceCharge * delPercCharge) / 100);
                                totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));
                            }
                            else if (postData.cod !== undefined && postData.cod === 1 && postData.purchaseType === "pickup") {
                                totalServiceCharge = totalServiceCharge - ((totalServiceCharge * delPercCharge) / 100);
                                totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));
                            }
                            else if (postData.purchaseType !== undefined && postData.purchaseType === "pickup") {
                                totalServiceCharge = totalServiceCharge - ((totalServiceCharge * delPercCharge) / 100);
                                totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));
                            } else {
                                deliveryCharge = (totalServiceCharge * delPercCharge) / 100;
                                if (deliveryCharge < minDelCharge) { deliveryCharge = minDelCharge }
                                deliveryCharge = parseFloat(deliveryCharge.toFixed(2));
                            }

                        }

                        //calculate tax
                        var country = '';
                        var totalTax = 0;
                        const options = {
                            provider: 'google',
                            apiKey: process.env.MAP_KEY,
                            formatter: null
                        };
                        const geocoder = NodeGeocoder(options);
                        //get tax settigns from databse
                        [tErr, tRes] = await to(TaxSet.find({}));
                        // Using callback ,
                        if (postData.lat !== undefined && postData.lat !== undefined && postData.long !== undefined && postData.long) {
                            const addresRes = await geocoder.reverse({ lat: postData.lat, lon: postData.long });
                            if (addresRes !== undefined) {
                                country = addresRes[0].countryCode;
                                for (const taxes of tRes) {
                                    if (taxes.countryCode === country) {

                                        if (taxes.taxType === 'flat') { totalTax = taxes.taxValue; }
                                        if (taxes.taxType === 'percentage') { totalTax = (orderTotalCost * taxes.taxValue) / 100; }
                                        totalTax = parseFloat(totalTax.toFixed(2));
                                    }
                                }
                            }
                        }

                        //calculate delivery charge if order is cod+delivery
                        if (postData.cod !== undefined && postData.cod === 1 && postData.purchaseType === "delivery") {
                            let ownerId = mongoose.Types.ObjectId(element.shopkeeperId);
                            [shopErr, shopRes] = await to(Shop.findOne({ ownerId: ownerId }));
                            if (shopRes && shopRes !== undefined && shopRes.codDeliveryCharge !== undefined && shopRes.codDeliveryCharge > 0) {
                                codDelCharge = shopRes.codDeliveryCharge;
                            }
                        }

                        var finSave = orderTotalCost + totalServiceCharge + totalTax + codDelCharge;
                        await to(Order.findOneAndUpdate({ _id: orderCreate._id }, {
                            $set: {
                                orderTotal: parseFloat(orderTotalCost.toFixed(2)),
                                pricepaid: parseFloat(finSave.toFixed(2)),
                                totalTax: parseFloat(totalTax.toFixed(2)),
                                address: address,
                                childOrder: childOrder,
                                merchantUserId: merchantId,
                                serviceCharge: totalServiceCharge,
                                deliveryCharge: deliveryCharge,
                                codDeliveryCharge: codDelCharge
                            }
                        }));
                            
                        //order placed notification
                        await to(emails.orderPlacedNotification(req, res, orderCreate._id));
                        await to(userOrderPlacedNotification(req, res, userId, orderCreate._id));
                        //await to(userOrderPlacedNotificationForDeliveryBoy(req, res, userId, orderCreate._id));
                        return ReS(res, { msg: "Order placed." }, 200);
                    }
                }

            }
        };
    });
}

//create transection
const createTransection = async function (req, res, payment_response, chargeId, userId) {
    let tranectionRes, err;
    var tscObj = {
        userId: userId,
        //paymentResponse : payment_response,
        paymentFor: "Order",
        paymentBy: "Card",
        chargeId: chargeId,
        chargeStatus: "captured",
        capturedAt: new Date(),
        createdAt: new Date()
    };
    [err, tranectionRes] = await to(Transection.create(tscObj));
    if (err) { return ReE(res, { msg: err.message }, 422); }
    return tranectionRes;

}

//calculate discount
const calculateDiscount = async function (req, res, cart_data) {

    if (cart_data.length > 0) {
        let postData = {};
        let payable_amount = 0;
        let couponCounter = 0;
        let addonsPrice = 0;
        let mycnnnnr = 0;
        //loop through all the cart elements
        for (const element of cart_data) {
            mycnnnnr = mycnnnnr+1;
            // console.log("--------------calculate loop runnig for-----------", mycnnnnr);

            let innerPrice = 0;
            if (element.productId.inStock !== undefined && element.productId.inStock < element.quantity) { if (element.productId.inStock === 0) { return ReE(res, { msg: element.productId.title + " is out of stock" }, 422); } else { return ReE(res, { msg: "Only " + element.productId.inStock + " quantity is available for " + element.productId.title }, 422); } }
            //addons price calculation
            if (element.addons !== undefined &&
                element.addons !== null &&
                element.addons.length > 0) {
                for (const addons of element.addons) {
                    if (addons.addonPrice !== undefined && addons.addonPrice && addons.addonPrice !== 0) {
                        addonsPrice = addonsPrice + (parseFloat(addons.addonPrice*element.quantity));
                    }
                }
            }

            //check if any discount is active on product
            if (element.productId &&
                element.productId.salePrice &&
                element.productId.salePrice !== '') {
                innerPrice = element.productId.salePrice * element.quantity;
            }
            else { innerPrice = element.productId.regularPrice * element.quantity; }

            if (element.productId &&
                element.productId.discountApplied !== undefined &&
                element.productId.discountApplied &&
                element.productId.discountApplied !== '' &&
                element.productId.discountApplied !== null) {
                var discountid = mongoose.Types.ObjectId(element.productId.discountApplied);

                [err, discRes] = await to(Discount.findOne({ _id: discountid }).then((response) => {
                    if (response) {

                        var date1 = new Date(response.expiry);
                        var date2 = new Date();
                        var Difference_In_Time = date1.getTime() - date2.getTime();
                        var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
                        let discountValue = response.discountValue;


                        if (Difference_In_Days > 0 && response.status == "1") {
                            let product = element.productId;
                            if (response.discountType == "percentage") {
                                innerPrice = (innerPrice - ((innerPrice * discountValue) / 100));
                            }
                            else if (response.discountType == "flat") {
                                innerPrice = innerPrice - (discountValue * element.quantity);
                            }
                        }

                    }
                }).catch(err => { return ReE(res, { msg: "", errors: err }, 422); }));
            }



            //check if a coupon applied by the user on cart
            if (element.couponApplied !== undefined &&
                element.couponApplied !== '' &&
                element.couponApplied !== null) {
                var coupId = mongoose.Types.ObjectId(element.couponApplied);

                [err, coupRes] = await to(Coupon.findOne({ _id: coupId }).then((response) => {
                    if (response) {

                        var date1 = new Date(response.expiry);
                        var date2 = new Date();
                        var Difference_In_Time = date1.getTime() - date2.getTime();
                        var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);

                        let price = 0;
                        if (element.productId.salePrice) { price = element.productId.salePrice; }
                        else if (element.productId.regularPrice) { price = element.productId.regularPrice; }
                        else { }


                        // if(Difference_In_Days > 0 && response.status =="active" && couponCounter === 0 )                       
                        if (Difference_In_Days > 0 &&
                            response.status == "active" &&
                            response.categories.indexOf(element.productId.categories) !== -1 &&
                            response.productMinPrice <= price*element.quantity) {
                            let couponValue = response.couponValue;

                            if (response.shopkeeperId !== undefined && response.shopkeeperId !== null) {
                                let newShopkepr = mongoose.Types.ObjectId(response.shopkeeperId);                                
                                if (newShopkepr.equals(element.productId.shopkeeperId)) 
                                {
                                    if (response.couponType == "Percent") { innerPrice = innerPrice - ((innerPrice * couponValue) / 100); }                                    
                                    else if (response.couponType == "flat") { innerPrice = innerPrice - couponValue; }
                                }
                            } else {
                                        if (response.couponType == "Percent") { innerPrice = innerPrice - ((innerPrice * couponValue) / 100); }                                
                                        else if (response.couponType == "flat") { innerPrice = innerPrice - couponValue;}
                                   }
                            //couponCounter++;
                        }
                    }
                }).catch(err => { return ReE(res, { msg: "", errors: err }, 422); }));


            }
            console.log("-----inner price-----", innerPrice);
            payable_amount = payable_amount + innerPrice;


        }
        // console.log("---payment send to pay fron calculate loop---", payable_amount+addonsPrice);
        return payable_amount+addonsPrice;
    } else { return ReE(res, { msg: "No product in cart at the moment" }); }

}

//get user cart
const getCart = async function (req, res, user_id, postData) {
    let response;
    // get all the items from cart for the current user
    [err, response] = await to(Cart.find({ userId: user_id }).populate('userId').populate({ path: 'addons', model: "Addons" }).populate('productId').lean());
    if (err) { return ReE(res, { msg: "", errors: err }, 422); }

    if (response) {
        [eErr, inactiveRes] = await to(User.findOne({ _id: response[0].shopkeeperId, account_activate: { $ne: "active" } }));
        if (inactiveRes && inactiveRes !== undefined && inactiveRes._id && inactiveRes._id !== undefined) {
            return ReE(res, { msg: "Shop is not active anymore" }, 422);
        }
    }

    let getUserAdd = {};
    getUserAdd.body = {}
    getUserAdd.body.userId = user_id;

    //require user address and name to get stripe payment token
    //[addrErr, address] = await to( UserController.getDefaultAddress( getUserAdd, res ) );

    // calculate to discount on cart items
    [discError, discResponse] = await to(calculateDiscount(req, res, response));
    console.log("----payable ffrom loop-----", discResponse);
    if (discError) { return ReE(res, { msg: "", errors: discError }, 422); }
    let payable = {};
    payable.payable_amount = discResponse;
    payable.merchantId = response[0].shopkeeperId;

    //merge all the three javascript objects
    let finalObject = { ...postData, ...payable };

    return finalObject;
}

exports.checkOrderData = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    let err, cartReponse, token, payerr, pay, resTrans;
    let response = {};
    let data = {};
    var statusArray = ["pending", "waitingfordeliveryBoy", "acceptedByDeliveryBoy", "readyToPickup", "pickedUpBydeliveryBoy", "delivered"];

    /*
    * Check if user is a authentic user, who is going to place order
    */
    if (!payload._id) { return ReE(res, { msg: "Unauthorised access" }, 422); }
    var userId = mongoose.Types.ObjectId(payload._id);

    [coErr, coRes] = await to(Order.find({ customerId: userId, status: { $in: statusArray } }));
    if (coRes && coRes.length > 0) { return ReE(res, { msg: "You can only order after previous order gets completed" }, 422); }

    var user_id = payload._id;

    if (postData.cod !== undefined &&
        postData.cod !== 1 &&
        postData.stripeCustomerId !== undefined &&
        postData.stripeCardId !== undefined &&
        postData.stripeCustomerId !== '' &&
        postData.stripeCardId !== '') {
        // Get user cart in this step and it will return default address for delivery
        [err, cartReponse] = await to(getCart(req, res, user_id, postData));
        //console.log("step payment ============================================>",cartReponse);
        if (cartReponse && cartReponse !== undefined) { postData.merchantId = cartReponse.merchantId; }


        [payerr, pay] = await to(dopayment(req, res, postData, cartReponse.payable_amount));
        if (payerr) { return ReE(res, { err: payerr }, 422); }

        //check if charge was succesfull
        if (pay.id) {
            //create the transection record in database collection
            [err, resTrans] = await to(createTransection(req, res, pay, pay.id, user_id));
            if (err) { return ReE(res, { err: err }, 422); }

            /*
            * In this final step create orders for each item in cart and after
            * creating order delete product from the cart
            */
            if (resTrans._id) {
                await to(insertOrder(req, res, user_id, resTrans._id, postData.utensils, postData.purchaseType));
            }
        }


    } else {
        await to(insertOrder(req, res, user_id, postData.cod, postData.utensils, postData.purchaseType));
    }
}

// get recent transection
exports.transectionHitory = async function (req, res, next) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload._id) {
        var userid = mongoose.Types.ObjectId(payload._id);
        const allTranection = await Transection.collection.find({ userId: userid }).count();

        var offsetRecord = (postData.page - 1) * postData.perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * postData.perPage;
        }



        Transection.aggregate([
            {
                $match: {
                    $and: [{ userId: userid }]
                },
            },
            { $skip: offsetRecord }, { $limit: postData.perPage }, { $sort: { createdAt: -1 } },
            {
                $lookup:
                {
                    from: "orders",
                    let: { orderId: "$orderId" },
                    pipeline: [
                        {
                            $match:
                            {
                                $expr:
                                {
                                    $and:
                                        [
                                            { $in: ["$_id", "$$orderId"] },
                                        ]
                                }
                            }
                        },
                    ],
                    as: "ordersData"
                }
            }

        ], (err, allData) => {
            if (err) {
                next(err);
                return;
            }

            var reminder = allTranection % postData.perPage;
            var totalPages = parseInt(allTranection / postData.perPage);
            if (reminder > 0) {
                totalPages++;
            }
            var pagination = {
                totalCount: allTranection,
                totalPages: totalPages,
                currentPage: postData.page
            };

            return ReS(res, { allData, pagination: pagination });


        });
    }
}

exports.getAllOrders = async function (req, res, next) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {
        var perPage = postData.perPage;
        var offsetRecord = (postData.page - 1) * perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * perPage;
        }


        var userid = '';
        var allorder;
        var condition;
        var statusArray = ["reject", "delivered", "complete"];

        //console.log(new Date(postData.startDate), new Date(postData.endDate));

        if (postData.shopkeeperId && postData.shopkeeperId !== '') {
            userid = mongoose.Types.ObjectId(postData.shopkeeperId);
            if (postData.startDate !== undefined && postData.endDate !== undefined) { condition = { merchantUserId: userid, paymentMode: postData.earningType, status: postData.orderStatus, completedAt: { $gte: new Date(postData.startDate), $lt: new Date(postData.endDate) } } }
            else if (postData.earningType !== undefined && postData.orderStatus !== undefined) { condition = { merchantUserId: userid, paymentMode: postData.earningType, status: postData.orderStatus } }
            else { condition = { merchantUserId: userid } }
            allorder = await Order.collection.find(condition).count();
        }
        else if (postData.userId && postData.userId !== '') {
            userid = mongoose.Types.ObjectId(postData.userId);
            condition = { customerId: userid, status: { $in: statusArray } }
            allorder = await Order.collection.find(condition).count();
        } else {
            allorder = await Order.collection.find().count();
            condition = { merchantUserId: { $exists: true } }
        }


        Order
            .find(condition)
            .sort({ createdAt: -1 })
            .skip(offsetRecord)
            .limit(perPage)
            .populate({
                path: 'childOrder',
                model: "OrderProducts",
                populate: ([
                    {
                        path: 'couponApplied',
                        model: "Coupon"
                    }, {
                        path: 'discountApplied',
                        model: "Discount"
                    }, {
                        path: 'productId',
                        model: "Product"
                    }
                ])
            })
            .populate({
                path: 'customerId',
                model: "User",
                select: { "firstname": 1, "lastname": 1, "email": 1, "mobile_number": 1 }
            })
            .lean()
            .exec(function (err, data) {
                var reminder = allorder % perPage;
                var totalPages = parseInt(allorder / perPage);
                if (reminder > 0) {
                    totalPages++;
                }




                let cod = 0;
                let card = 0;
                let total = 0

                for (const order of data) {
                    if (order.paymentMode == "card") { card = card + order.orderTotal; }
                    if (order.paymentMode == "cod") { cod = cod + order.pricepaid; }
                }
                let priceObject = {};
                priceObject.codEarnings = cod;
                priceObject.cardEarnings = card;
                priceObject.totalEarnings = cod + card;

                var pagination = {
                    totalCount: allorder,
                    totalPages: totalPages,
                    currentPage: postData.page,
                    priceObject: priceObject
                };
                return ReS(res, { allData: data, pagination: pagination });
            });

    }
}



exports.searchOrders = async function (req, res, next) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {
        var perPage = postData.perPage;
        var offsetRecord = (postData.page - 1) * perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * perPage;
        }

        const searchString = new RegExp(postData.search, "i");

        var userid = '';
        var allorder;
        var condition;
        var statusArray = ["reject", "delivered", "complete"];


        if (postData.shopkeeperId && postData.shopkeeperId !== '') {
            userid = mongoose.Types.ObjectId(postData.shopkeeperId);
            if (postData.earningType !== undefined && postData.orderStatus !== undefined) { condition = { merchantUserId: userid, paymentMode: postData.earningType, status: postData.orderStatus, userOrderId: searchString } }
            else { condition = { merchantUserId: userid, userOrderId: searchString } }
            allorder = await Order.collection.find(condition).count()
        }
        else if (postData.userId && postData.userId !== '') {

            userid = mongoose.Types.ObjectId(postData.userId);
            allorder = await Order.collection.find({ customerId: userid, status: { $in: statusArray }, userOrderId: searchString }).count();
            condition = { customerId: userid, status: { $in: statusArray }, userOrderId: searchString }
        } else {
            allorder = await Order.collection.find({ merchantUserId: { $exists: true }, userOrderId: searchString }).count();
            condition = { merchantUserId: { $exists: true }, userOrderId: searchString }
        }


        Order
            .find(condition)
            .sort({ createdAt: -1 })
            .skip(offsetRecord)
            .limit(perPage)
            .populate({
                path: 'childOrder',
                model: "OrderProducts",
                populate: ([
                    {
                        path: 'couponApplied',
                        model: "Coupon"
                    }, {
                        path: 'discountApplied',
                        model: "Discount"
                    }, {
                        path: 'productId',
                        model: "Product"
                    }
                ])
            })
            .populate({
                path: 'customerId',
                model: "User",
                select: { "firstname": 1, "lastname": 1, "email": 1, "mobile_number": 1 }
            })
            .exec(function (err, data) {
                var reminder = allorder % perPage;
                var totalPages = parseInt(allorder / perPage);
                if (reminder > 0) {
                    totalPages++;
                }
                let cod = 0;
                let card = 0;
                let total = 0

                for (const order of data) {
                    if (order.paymentMode == "card") { card = card + order.orderTotal; }
                    if (order.paymentMode == "cod") { cod = cod + order.pricepaid; }
                }
                let priceObject = {};
                priceObject.codEarnings = cod;
                priceObject.cardEarnings = card;
                priceObject.totalEarnings = cod + card;

                var pagination = {
                    totalCount: allorder,
                    totalPages: totalPages,
                    currentPage: postData.page,
                    priceObject: priceObject
                };
                return ReS(res, { allData: data, pagination: pagination });
            });

    }
}

//get details of a single order
exports.getSingleOrder = async function (req, res, next) {
    const payload = req.decoded;
    const postData = req.body;
    var merchantId = '';
    if (payload._id) {
        var orderId = mongoose.Types.ObjectId(postData.orderId);


        Order
            .find({ _id: orderId })
            .populate({
                path: 'childOrder',
                model: "OrderProducts",
                populate: ([
                    {
                        path: 'couponApplied',
                        model: "Coupon"
                    }, {
                        path: 'discountApplied',
                        model: "Discount"
                    }, {
                        path: 'productId',
                        model: "Product"
                    }
                ])
            })
            .populate({
                path: 'customerId',
                model: "User",
                select: { "_id": 1, "firstname": 1, "lastname": 1, "email": 1, "mobile_number": 1, "profile_image": 1 }
            })
            .populate({
                path: 'acceptedForDeliveryBy',
                model: "User",
                select: { "_id": 1, "firstname": 1, "lastname": 1, "email": 1, "mobile_number": 1, "profile_image": 1 }
            })
            .lean()
            .exec(async function (err, allData) {

                var innerarray = [];
                if (allData.length > 0) {
                    innerarray = allData[0].childOrder.map((data, index) => {
                        let priceHold = {};
                        let price = data.pricePerItem;
                        let discount = 0;
                        let couponDiscount = 0;

                        //calculate discount
                        if (data.discountApplied !== null &&
                            data.discountApplied !== undefined &&
                            data.discountApplied._id !== undefined &&
                            data.discountApplied._id !== null) {
                            let disc = data.discountApplied;
                            if (disc.discountType == "percentage") {
                                discount = ((price * disc.discountValue) / 100) * data.quantity;
                            }
                            else if (disc.discountType == "flat") {
                                discount = disc.discountValue * data.quantity;
                            }
                        }
                        merchantId = data.merchantUserId;

                        //calculate discount
                        if (data.couponApplied !== null &&
                            data.couponApplied !== undefined &&
                            data.couponApplied._id !== undefined &&
                            data.couponApplied._id !== null) {
                            let coup = data.couponApplied;
                            if (coup.couponType == "Percent") {
                                couponDiscount = (((price * data.quantity) - discount) * coup.couponValue) / 100;
                            } else if (coup.couponType == "flat") {
                                couponDiscount = coup.couponValue * data.quantity;
                            }
                        }

                        //insert price object to child order object
                        priceHold["totalPrice"] = price * data.quantity;
                        priceHold["discount"] = discount;
                        priceHold["couponDiscount"] = couponDiscount;

                        let temp = { ...data };
                        temp["priceObject"] = priceHold;
                        return temp;

                    });

                    if(merchantId && merchantId !==''){
                         [er, rs] = await to(Shop.findOne({ ownerId: merchantId }, { created_date: 0, updated_date: 0 }));
                            if (rs) {
                                allData[0].shopInfo = rs;
                                //holdAllOrder.push(order);
                            }
                    }

                    allData[0].childOrder = innerarray;

                    return ReS(res, { allData });
                } else { return ReS(res, { msg: "order not found" }); }

            });
    }
}

//get details of a single order
exports.markOrderAsPaid = async function (req, res, next) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {

        Order.findOneAndUpdate(
            { _id: postData.orderId },
            { $set: { paymentStatus: "complete" } },
            function (error, success) {
                if (error) {
                    return ReE(res, { msg: "Unable to process your request!", errors: err }, 422);
                } else {
                    // return ReS(res, { msg:"Favourite added successfully." });
                    return ReS(res);
                }
            });

    }
}

//get orders which are delivered
exports.getPastOrder = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {
        // var perPage = postData.perPage;
        var userId = mongoose.Types.ObjectId(payload._id);
        var statusArray = ["reject", "complete"];

        // var offsetRecord = (postData.page-1) * perPage;
        // if( postData.page == 0 ){
        //     offsetRecord = (postData.page) * perPage;
        // }

        //var allorder = await Order.collection.find({  customerId : userId, status : { $nin  : ["pending","ready", "pickedUp"] }  }).count();

        Order
            .find({ customerId: userId, status: { $in: statusArray } })
            .sort({ createdAt: -1 })
            .populate({
                path: 'childOrder',
                model: "OrderProducts",
                populate: ([
                    {
                        path: 'couponApplied',
                        model: "Coupon"
                    }, {
                        path: 'discountApplied',
                        model: "Discount"
                    }, {
                        path: 'productId',
                        model: "Product"
                    }
                ])
            })
            .populate({
                path: 'acceptedForDeliveryBy',
                model: "User",
                select: { "firstname": 1, "lastname": 1, "email": 1, "profile_image": 1 }
            })
            .lean()
            .exec(async function (err, data) {

                if (data.length > 0) {
                    var childOrders = [];
                    for (const order of data) {
                        var thisOwner = mongoose.Types.ObjectId(order.merchantUserId);
                        [er, rs] = await to(Shop.findOne({ ownerId: thisOwner }, { created_date: 0, updated_date: 0 }));
                        if (rs) {
                            order.shopInfo = rs;
                            //holdAllOrder.push(order);
                        }
                        var thisOrderId = mongoose.Types.ObjectId(order._id);
                        [oErr, oRes] = await to(DeliveryRatingReview.findOne({ orderId: thisOrderId }));
                        if (oRes) {
                            order.reviewFound = true;
                        }
                        if (oRes === null) { order.reviewFound = false; }

                        if (postData.home !== undefined && postData.home && postData.home == true) {
                            if (order.childOrder !== undefined && order.childOrder && order.childOrder.length > 0) {
                                let cntr = 0
                                for (const child of order.childOrder) {
                                    if (child.productId && child.productId._id !== undefined && childOrders.indexOf(child.productId._id) != -1) {
                                        //remove this product
                                        //delete order.childOrder[cntr];
                                        order.childOrder.splice(cntr, 1);
                                    } else {
                                        if (child.productId) { childOrders.push(child.productId._id); }
                                    }
                                    cntr = cntr + 1;
                                }
                            }
                        }
                    }
                }

                // var reminder = allorder % postData.perPage;
                // var totalPages = parseInt(allorder / postData.perPage);
                // if (reminder > 0) {
                //     totalPages++;
                // }
                // var pagination = {
                //     totalCount: allorder,
                //     totalPages: totalPages,
                //     currentPage: postData.page
                // };

                return ReS(res, { data });
            });
    }
}


exports.calculateDistance = async function (req, res, body) {
    return new Promise(function (resolve, reject) {
        try {
            distance.get({
                index: 1,
                origin: body.shoplat + "," + body.shopLong,
                destination: body.userLat + "," + body.userLong
            },
                function (err, distncedata) {
                    if (distncedata && distncedata.distanceValue) {
                        if ((distncedata.distanceValue / 1000) <= process.env.NEAR_SHOP_RANGE) { resolve(1); }
                        else { resolve(0); }
                    }
                });
        } catch (e) {
            reject();
            res.status(422).json({ msg: "failed calculate disctance function" });
        }
    });
}

// //get orders which need to delivered
// exports.getCurrentOrder = async function(req, res){
//     const payload = req.decoded;
//     const postData = req.body;
//     if(payload._id){
//         var statusArray = ["pending", "waitingfordeliveryBoy", "acceptedByDeliveryBoy", "readyToPickup", "pickedUpBydeliveryBoy" ];
//         // var perPage = postData.perPage;
//        var userId = mongoose.Types.ObjectId( payload._id );
//        Order
//         .findOne({ customerId : userId, status : { $in  : statusArray }})
//         .populate({
//             path : 'childOrder',
//             model : "OrderProducts",
//             populate :([
//                 {
//                     path : 'couponApplied',
//                     model : "Coupon"
//                 },{
//                     path : 'discountApplied',
//                     model : "Discount"
//                 },{
//                     path : 'productId',
//                     model : "Product"
//                 }
//             ])
//         })
//         .populate({
//             path : 'acceptedForDeliveryBy',
//             model : "User",
//             select: { "firstname" : 1, "lastname" : 1, "email" : 1 , "profile_image" : 1}
//         })
//         .lean()
//         //.skip(offsetRecord).limit(perPage)
//         .exec( async function (err, data) {
//             //return if error
//             if(err && err !== undefined){ return ReE(res, { msg : err.message }); }

//             var cntr = data.length;
//             var loopCntr = 0;

//                     var thisOwner = mongoose.Types.ObjectId( data.merchantUserId );

//                     [er, rs] = await to (Shop.findOne({ ownerId : thisOwner },{created_date:0,updated_date:0}));
//                     if(er && er !== undefined){ return ReE(res, { msg : er.message }); }

//                     if(rs){
//                          data.shopInfo = rs;
//                          let shopLat = rs.address.lat;
//                          let shopLong = rs.address.long;

//                          let userLat = data.address.lat;
//                          let userLong = data.address.long;

//                          Request.post({
//                                     "headers": { "content-type": "application/json" },
//                                     "url": 'https://maps.googleapis.com/maps/api/directions/json?origin='+shopLat+','+shopLong+'&destination='+userLat+','+userLong+'&departure_time=now&key='+process.env.MAP_KEY,
//                                     "body": JSON.stringify({ })
//                                 }, (error, response, body) => {
//                                     // if error return from here
//                                     if(error && error !== undefined){ return ReE(res, { msg : error.message }); }

//                                     if(body !== undefined && body){

//                                         var obj = JSON.parse(body);
//                                         if( obj.routes && obj.routes.length > 0){

//                                             let date = new Date(data.createdAt);
//                                                 date.setSeconds( date.getSeconds() + obj.routes[0].legs[0].duration.value );

//                                             var options = { hour: 'numeric', minute: 'numeric', hour12: true };
//                                             data.orderArrivalTime = date.toLocaleString('en-US', options);
//                                             loopCntr++;

//                                             return ReS(res, { data });
//                                         } else { return ReS(res, { data }); }

//                                     } else { return ReS(res, { data }); }
//                             });
//                         }
//          });
//     } else{ return ReE(res, { msg : "Unauthorised access" }); }
// }



//get orders which need to delivered
exports.getCurrentOrder = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {
        let user = payload._id;
        if (postData.isAdminQuery !== undefined && postData.isAdminQuery) { user = postData.userId; }

        var statusArray = ["pending", "preparing", "waitingfordeliveryBoy", "acceptedByDeliveryBoy", "readyToPickup", "pickedUpBydeliveryBoy", "delivered"];
        // var perPage = postData.perPage;
        var userId = mongoose.Types.ObjectId(user);
        Order
            .findOne({ customerId: userId, status: { $in: statusArray } })
            .populate({
                path: 'childOrder',
                model: "OrderProducts",
                populate: ([
                    {
                        path: 'couponApplied',
                        model: "Coupon"
                    }, {
                        path: 'discountApplied',
                        model: "Discount"
                    }, {
                        path: 'productId',
                        model: "Product"
                    }
                ])
            })
            .populate({
                path: 'acceptedForDeliveryBy',
                model: "User",
                select: { "_id": 1, "firstname": 1, "lastname": 1, "email": 1, "profile_image": 1 }
            })
            .lean()
            //.skip(offsetRecord).limit(perPage)
            .exec(async function (err, data) {
                //return if error
                if (err && err !== undefined) { return ReE(res, { msg: err.message }); }
                if (!data) { return ReS(res, { data: [] }); }
                if (data.merchantUserId == undefined || data.merchantUserId == "" || data.merchantUserId == null) { return ReS(res, { data }); }



                //var cntr = data.length;
                var loopCntr = 0;
                if (data.merchantUserId == undefined || data.merchantUserId == "" || data.merchantUserId == null) { return ReS(res, { data }); }

                var thisOwner = mongoose.Types.ObjectId(data.merchantUserId);

                [er, rs] = await to(Shop.findOne({ ownerId: thisOwner }, { created_date: 0, updated_date: 0 }));
                if (er && er !== undefined) { return ReE(res, { msg: er.message }); }

                if (rs) {
                    data.shopInfo = rs;
                    let shopLat = rs.address.lat;
                    let shopLong = rs.address.long;

                    let userLat = data.address.lat;
                    let userLong = data.address.long;
                    if ((data.address.lat === undefined || data.address.lat == null || data.address.lat == '') ||
                        (data.address.long === undefined || data.address.long == null || data.address.long == '')
                    ) {
                        //console.log("data on 1449 ================>", data)
                        return ReS(res, { data });
                    }

                    Request.post({
                        "headers": { "content-type": "application/json" },
                        "url": 'https://maps.googleapis.com/maps/api/directions/json?origin=' + shopLat + ',' + shopLong + '&destination=' + userLat + ',' + userLong + '&departure_time=now&key=' + process.env.MAP_KEY,
                        "body": JSON.stringify({})
                    }, (error, response, body) => {
                        // if error return from here
                        if (error && error !== undefined) { return ReE(res, { msg: error.message }); }

                        if (body !== undefined && body) {

                            var obj = JSON.parse(body);
                            if (obj.routes && obj.routes.length > 0) {

                                let date = new Date(data.createdAt);
                                date.setSeconds(date.getSeconds() + obj.routes[0].legs[0].duration.value);

                                var options = { hour: 'numeric', minute: 'numeric', hour12: true };
                                data.orderArrivalTime = date.toLocaleString('en-US', options);
                                loopCntr++;
                                //console.log("data on 1472 ================>", data)

                                return ReS(res, { data });
                            } else {
                                //console.log("data on 1477 ================>", data)

                                return ReS(res, { data });
                            }
                        } else {
                            //console.log("data on 1480================>", data)

                            return ReS(res, { data });
                        }
                    });
                }
            });
    } else { return ReE(res, { msg: "Unauthorised access" }); }
}



//get orders which are need to delivere
exports.getOrdersTodeliver = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {
        var perPage = postData.perPage;
        var userId = mongoose.Types.ObjectId(payload._id);

        var offsetRecord = (postData.page - 1) * perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * perPage;
        }

        var allorder = await Order.collection.find({
            $and: [
                { $or: [{ status: "waitingfordeliveryBoy" }, { acceptedForDeliveryBy: userId }] },
                { customerId: { $ne: userId } },
                { purchaseType: "delivery" },
                { status: { $nin: ["cancelled", "refunded", "rejected", "complete"] } }
            ]
        }).count();

        Order
            .find({
                $and: [
                    { $or: [{ status: "waitingfordeliveryBoy" }, { acceptedForDeliveryBy: userId }] },
                    { customerId: { $ne: userId } },
                    { purchaseType: "delivery" },
                    { status: { $nin: ["cancelled", "refunded", "rejected", "complete"] } }
                ]

            })
            .sort({ createdAt: -1 })
            .populate({
                path: 'childOrder',
                model: "OrderProducts",
                populate: ([
                    {
                        path: 'couponApplied',
                        model: "Coupon"
                    }, {
                        path: 'discountApplied',
                        model: "Discount"
                    }, {
                        path: 'productId',
                        model: "Product"
                    }
                ])
            })
            .populate('customerId')
            .lean()
            .skip(offsetRecord).limit(perPage)
            .exec(async function (err, data) {
                var holdAllOrder = [];


                if (data.length > 0) {

                    for (const order of data) {
                        var thisOwner = mongoose.Types.ObjectId(order.merchantUserId);
                        [er, rs] = await to(Shop.findOne({ ownerId: thisOwner }, { created_date: 0, updated_date: 0 }));
                        if (rs) {
                            order.shopInfo = rs;
                            holdAllOrder.push(order);
                        }
                    }
                }

                var reminder = allorder % postData.perPage;
                var totalPages = parseInt(allorder / postData.perPage);
                if (reminder > 0) {
                    totalPages++;
                }
                var pagination = {
                    totalCount: allorder,
                    totalPages: totalPages,
                    currentPage: postData.page
                };
                return ReS(res, { data, pagination: pagination });
            });
    }
}

exports.getOrderById = async function (req, res) {
    var id = req.body.id;

    Order.findOne({ _id: id }).lean().populate('customerId').then(data => {
        childOrderDetails = [];
        var i = -1;
        var next = () => {
            i++;
            if (i < data.childOrder.length) {
                OrderProduct.findOne({ _id: data.childOrder[i] }).lean().populate("productId").then(datachildOrder => {
                    childOrderDetails[i] = datachildOrder;
                    next();
                })
                    .catch(errChild => {
                        return ReE(res, { msg: "error while getting child order by id", error: errChild });

                    })
            }
            else {
                data.order_products = childOrderDetails;
                return ReS(res, { data });
            }
        }
        next();

    })
        .catch(err => {
            return ReE(res, { msg: "error while getting order by id", error: err });

        })
}

//this function works when the delivery boy select/accept a order to deliver
exports.acceptOrderToDeliver = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload._id && postData.orderId) {

        Order
            .findOne({ _id: postData.orderId, acceptedForDeliveryBy: null })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: postData.orderId },
                        {
                            $set:
                            {
                                status: "acceptedByDeliveryBoy",
                                acceptedForDeliveryBy: payload._id,
                                acceptedAt: new Date()
                            }
                        },
                        { new: true }));

                    //push notification to customer
                    await to(Notification.driverAcceptedOrder(req, res, data.customerId));

                    if (oRes) { return ReS(res, { msg: "Order accepted successfully" }); }
                    if (oErr) { return ReE(res, { error: oErr }, 422); }

                } else { return ReE(res, { msg: "Order accepted by someone else" }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

//this function works when a delivery pickedUp the order from shop
exports.OrderPickedUpByDeliverBoy = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload._id && postData.orderId) {

        Order
            .findOne({ _id: postData.orderId, acceptedForDeliveryBy: payload._id, status: "readyToPickup" })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: postData.orderId },
                        {
                            $set:
                            {
                                status: "pickedUpBydeliveryBoy",
                                pickedForDeliveryAt: new Date()
                            }
                        },
                        { new: true }));

                    //push notification to customer
                    await to(Notification.driverOnTheWay(req, res, data.customerId));

                    if (oRes) { return ReS(res, { msg: "Order successfully picked" }); }
                    if (oErr) { return ReE(res, { error: oErr }, 422); }

                } else { return ReE(res, { msg: "Order not prepaired by shop" }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

//this function works when a delivery delivered the order from shop
exports.OrderDeliveredByDeliverBoy = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload._id && postData.orderId) {

        Order
            .findOne({ _id: postData.orderId, acceptedForDeliveryBy: payload._id, status: 'pickedUpBydeliveryBoy' })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: postData.orderId },
                        {
                            $set:
                            {
                                status: "delivered",
                                deliveredBy: payload._id,
                                deliveredAt: new Date()
                            }
                        },
                        { new: true }));

                    //push notification to customer
                    await to(Notification.orderDelivered(req, res, data.customerId));

                    if (oRes) { return ReS(res, { msg: "Order successfully delivered" }); }
                    if (oErr) { return ReE(res, { error: oErr }, 422); }

                } else { return ReE(res, { msg: "Order is still waiting to pickup" }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

//This function works when a order completed
exports.OrderCompletedByDeliverBoy = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload._id && postData.orderId) {


        let searchStatus = "delivered";

        if (postData.orderStatus !== undefined && postData.orderStatus == "readyToPickup") { searchStatus = postData.orderStatus; }


        Order
            .findOne({ _id: postData.orderId, status: searchStatus })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: postData.orderId },
                        {
                            $set:
                            {
                                status: "complete",
                                completedBy: payload._id,
                                completedAt: new Date()
                            }
                        },
                        { new: true }));

                    // trafer order price to shop
                    if (data.merchantUserId && data.paymentMode == "card") {
                        var ownerId = mongoose.Types.ObjectId(data.merchantUserId);
                        [uErr, uRes] = await to(User.findOne({ _id: ownerId }));
                        if (uRes && uRes.stripeAccountId !== null) {

                            var priceToTransfer = data.orderTotal * 100;

                            [tErr, transfer] = await to(stripe.transfers.create({
                                amount: priceToTransfer,
                                currency: 'cad',
                                destination: uRes.stripeAccountId
                                //transfer_group: 'ORDER_95',
                            }));


                            if (tErr && tErr !== undefined) { await to(Order.findOneAndUpdate({ _id: postData.orderId }, { $set: { fundTransferErrorForShop: tErr } }, { new: true })); }
                            if (transfer && transfer !== undefined && transfer.id) { await to(Order.findOneAndUpdate({ _id: postData.orderId }, { $set: { shopFundTransferId: transfer.id } }, { new: true })); }

                        } else {
                            await to(Order.findOneAndUpdate({ _id: postData.orderId }, { $set: { fundTransferErrorForShop: "merchant account not linked" } }, { new: true }));
                        }
                    }

                    // tradefer deliver charge to delivery boy
                    if (data.deliveredBy !== undefined &&
                        data.deliveredBy &&
                        data.deliveredBy !== null &&
                        data.deliveredBy !== '') {
                        var ownerId = mongoose.Types.ObjectId(data.deliveredBy);
                        [dErr, dRes] = await to(User.findOne({ _id: ownerId }));
                        if (dRes && dRes.stripeAccountId !== null) {

                            var priceToTransfer = data.deliveryCharge * 100;

                            [utErr, Utransfer] = await to(stripe.transfers.create({
                                amount: priceToTransfer,
                                currency: 'cad',
                                destination: dRes.stripeAccountId
                                //transfer_group: 'ORDER_95',
                            }));


                            if (utErr && utErr !== undefined) { await to(Order.findOneAndUpdate({ _id: postData.orderId }, { $set: { fundTransferErrorForDeliveryBoy: utErr } }, { new: true })); }
                            if (Utransfer && Utransfer !== undefined && Utransfer.id) { await to(Order.findOneAndUpdate({ _id: postData.orderId }, { $set: { deliveryBoyFundTransferId: Utransfer.id } }, { new: true })); }

                        } else {
                            await to(Order.findOneAndUpdate({ _id: postData.orderId }, { $set: { fundTransferErrorForDeliveryBoy: "delivery boy account not linked" } }, { new: true }));
                        }
                    }

                    [shopErr, shopRes] = await to(Shop.findOne({ ownerId: data.merchantUserId }));
                    if (shopRes !== undefined && shopRes._id !== undefined) {
                        //push notification to customer
                        await to(Notification.rateOrder(req, res, data.customerId, data._id, payload._id, shopRes._id));
                    }

                    if (oRes) { return ReS(res, { msg: "Order successfully completed" }); }
                    if (oErr) { return ReE(res, { error: oErr }, 422); }

                } else { return ReE(res, { msg: "Order still waiting for delivery " }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

//This function works when a order accepted by shop
exports.markOrderAcceptedByShop = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload._id && postData.orderId) {
        let setStatus = "waitingfordeliveryBoy";

        if (postData.orderStatus !== undefined && postData.orderStatus == "preparing") { setStatus = postData.orderStatus; }

        Order
            .findOne({ _id: postData.orderId, status: 'pending' })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: postData.orderId },
                        {
                            $set:
                            {
                                status: setStatus,
                                shopAcceptedAt: new Date()
                            }
                        },
                        { new: true }));

                    if (oRes) { return ReS(res, { msg: "Order successfully accepted" }); }
                    if (oErr) { return ReE(res, { error: oErr }, 422); }

                } else { return ReE(res, { msg: "No order found" }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

//This function works when a order prepaired by shop
exports.markOrderPrepaired = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload._id && postData.orderId) {

        let checkStatus = "acceptedByDeliveryBoy";
        let setStatus = "readyToPickup";

        if (postData.orderStatus !== undefined && postData.orderStatus == "preparing") {
            checkStatus = postData.orderStatus;
            //setStatus = "complete";
        }

        Order
            .findOne({ _id: postData.orderId, status: checkStatus })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: postData.orderId },
                        {
                            $set:
                            {
                                status: setStatus,
                                shopPrepairedAt: new Date()
                            }
                        },
                        { new: true }));

                    if (oRes) {

                        if(checkStatus == "acceptedByDeliveryBoy"){
                          //push notification to customer 
                          await to(Notification.orderPrepared(req, res, data.customerId));
                        }else{
                          //push notification to customer to pickup order
                          await to(Notification.preparedForPickupOrder(req, res, data.customerId));

                          //send email to self pickup customer for order prepaired
                          await to(emails.orderPreparedByShop(req, res, oRes));
                        }                        
                       
                        return ReS(res, { msg: "Order successfully prepaired" });
                    }
                    if (oErr) { return ReE(res, { error: oErr }, 422); }

                } else { return ReE(res, { msg: "Order is not accepted by delivery boy" }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

//This function works when a order accepted by shop
exports.markOrderRejectedByShop = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload._id && postData.orderId) {
        let setStatus = "reject";

        Order
            .findOne({ _id: postData.orderId, status: 'pending' })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: postData.orderId },
                        {
                            $set:
                            {
                                status: setStatus,
                                rejectedBy: payload._id,
                                rejectedAt: new Date()
                            }
                        },
                        { new: true }));

                    if (data.paymentMode == "card") {
                        //get the payment intent id from transection collection
                        [tErr, tRes] = await to(Transection.findOne({ _id: data.transactionId }));
                        if (tErr) { return ReE(res, { msg: tErr.message }, 422); }

                        //refund the amount of order
                        [rErr, rRes] = await to(stripe.refunds.create({ payment_intent: tRes.chargeId, reason: "requested_by_customer" }));
                        if (rErr) { return ReE(res, { msg: rErr.message }, 422); }

                        //store the refund id
                        [ooErr, ooRes] = await to(Order.findOneAndUpdate({ _id: postData.orderId }, { $set: { rejectedFundTransferId: rRes.id } }, { new: true }));
                        if (ooErr) { return ReE(res, { msg: ooErr.message }, 422); }
                    }
                    if (oRes) {
                        //send email to customer that order is rejected
                        [eErr, eRes] = await to(emails.orderRejectedByShop(req, res, data));
                    }

                    //return when success
                    if (oRes) { return ReS(res, { msg: "Order successfully rejected" }); }
                    if (oErr) { return ReE(res, { error: oErr }, 422); }

                } else { return ReE(res, { msg: "No order found" }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

exports.cancelMyorder = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id && postData.orderId) {
        let setStatus = "cancelled";

        Order
            .findOne({ _id: postData.orderId, customerId: payload._id })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    if (data.status !== "pending") { return ReS(res, { msg: "Order can not be cancel now" }); }
                    // if (data.status === "readyToPickup") { return ReS(res, { msg: "Order is prepared and cannot be cacelled" }); }
                    // if (data.status === "complete") { return ReS(res, { msg: "Order is prepared and cannot be cacelled" }); }
                    

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: postData.orderId, customerId: payload._id },
                        {
                            $set:
                            {
                                status: setStatus,
                                cancelBy: payload._id,
                                canceledAt: new Date()
                            }
                        },
                        { new: true }));


                    if (data.transactionId !== undefined && data.transactionId !== null && data.transactionId) {
                        //get the payment intent id from transection collection
                        [tErr, tRes] = await to(Transection.findOne({ _id: data.transactionId }));
                        if (tErr) { return ReE(res, { msg: tErr.message }, 422); }

                        //refund the amount of order
                        [rErr, rRes] = await to(stripe.refunds.create({ payment_intent: tRes.chargeId, reason: "requested_by_customer" }));
                        if (rErr) { return ReE(res, { msg: rErr.message }, 422); }

                        //store the refund id
                        [ooErr, ooRes] = await to(Order.findOneAndUpdate({ _id: postData.orderId }, { $set: { canceledFundTransferId: rRes.id } }, { new: true }));
                        if (ooErr) { return ReE(res, { msg: ooErr.message }, 422); }
                    }


                    //send email to customer that order is rejected
                    [eErr, eRes] = await to(emails.orderCanceledByUser(req, res, oRes));


                    //return when success
                    if (oErr) { return ReE(res, { error: oErr }, 422); }
                    if (oRes) { return ReS(res, { msg: "Order cancelled" }); }


                } else { return ReE(res, { msg: "No order found" }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

exports.getRecentOrdersFromShop = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {

        var userId = mongoose.Types.ObjectId(payload._id);

        var merchantUserId = mongoose.Types.ObjectId(postData.shopkeeperId);
        Order
            .find({ customerId: userId, merchantUserId: merchantUserId })
            .sort({ createdAt: -1 })
            .populate({
                path: 'childOrder',
                model: "OrderProducts",
                populate: ([
                    {
                        path: 'couponApplied',
                        model: "Coupon"
                    }, {
                        path: 'discountApplied',
                        model: "Discount"
                    }, {
                        path: 'productId',
                        model: "Product"
                    }
                ])
            })
            .lean()
            .exec(async function (err, data) {
                var childOrders = [];
                if (data.length > 0) {

                    for (const order of data) {
                        for (const child of order.childOrder) {
                            if (child.productId && child.productId !== undefined && child.productId._id !== undefined && child.productId._id !== null && child.productId._id && childOrders.includes(child.productId._id)) { }
                            else { if (child.productId && child.productId._id) { childOrders.push(child.productId._id) } }
                        }
                    }

                    if (childOrders.length > 0) {

                        var today = new Date();
                        var endDay = new Date("01-01-3000");

                        Product.aggregate([
                            { $match: { _id: { $in: childOrders } } },
                            {
                                $lookup:
                                {
                                    from: "categories",
                                    let: { categories: "$categories" },
                                    pipeline: [
                                        {
                                            $match:
                                            {
                                                $expr:
                                                {
                                                    $and:
                                                        [
                                                            { $eq: ["$_id", "$$categories"] },
                                                        ]
                                                }
                                            }
                                        },
                                    ],
                                    as: "categoryData"
                                }
                            },
                            {
                                $lookup:
                                {
                                    from: "tags",
                                    let: { tag: "$tags" },
                                    pipeline: [
                                        {
                                            $match:
                                            {
                                                $expr:
                                                {
                                                    $and:
                                                        [
                                                            { $in: ["$_id", "$$tag"] },
                                                        ]
                                                }
                                            }
                                        },
                                    ],
                                    as: "tagData"
                                }
                            },
                            {
                                $lookup:
                                {
                                    from: "discounts",
                                    let: { discId: "$discountApplied" },
                                    pipeline: [
                                        {
                                            $match:
                                            {
                                                $expr: {
                                                    $and: [
                                                        { $eq: ["$_id", "$$discId"] }
                                                    ]
                                                },
                                                expiry: { '$gt': today, '$lt': endDay }

                                            },

                                        }
                                    ],
                                    as: "discountData"
                                }
                            },
                            {
                                "$unwind": {
                                    "path": "$discountData",
                                    "preserveNullAndEmptyArrays": true
                                }
                            },
                            {
                                $lookup:
                                {
                                    from: "ratingreviews",
                                    let: { proId: "$_id" },
                                    pipeline: [
                                        {
                                            $match:
                                            {
                                                $expr:
                                                {
                                                    $and:
                                                        [
                                                            { $eq: ["$productId", "$$proId"] },
                                                        ]
                                                }
                                            }
                                        },
                                        {
                                            $group: {
                                                _id: null,
                                                avgRating: { $avg: "$rating" }
                                            }
                                        }
                                    ],
                                    as: "ratingData"
                                }
                            }

                        ], (err, allData) => {
                            return ReS(res, { allData });
                        });

                    } else { return ReS(res, { allData: [] }); }
                } else { return ReS(res, { allData: [] }); }
            });

    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

exports.markOrderArrived = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id && postData.orderId) {

        Order
            .findOne({
                _id: postData.orderId,
                acceptedForDeliveryBy: payload._id
            })
            .exec(async function (err, data) {
                if (data && data !== null) {

                    [oErr, oRes] = await to(Order.findOneAndUpdate(
                        { _id: data._id },
                        {
                            $set:
                            {
                                reachedAt: new Date()
                            }
                        },
                        { new: true }));
                    //push notification to customer
                    await to(Notification.orderArrived(req, res, data.customerId));
                    return ReS(res, { msg: "Order Arrived" }, 422);
                } else { return ReE(res, { msg: "No order found" }, 422); }
            });


    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

module.exports = exports;
