var mongoose = require('mongoose');
const { to, ReS, ReE, ValidationErrors } = require('../services/util.service');
var ObjectId = require('mongoose').Types.ObjectId;
var async = require("async");
// const Coupon = require("../models/Coupon.model");
const Cart = require("../models/Cart.model");
const Coupon = require("../models/Coupon.model");
const Discount = require("../models/Discount.model");
const Product = require("../models/Product.model");
const Addons = require("../models/Addons.model.js");
const TaxSet = require("../models/TaxSetting.model.js")
const NodeGeocoder = require('node-geocoder');
const Shop = require("../models/Shop.model");
const User = require("../models/User.model");
var distance = require('google-distance');
distance.apiKey = process.env.MAP_KEY;

/*---------------------------------*/
// function to add product into cart
/*---------------------------------*/

exports.addToCart = async function (req, res) {
    var data = req.body;
    const payload = req.decoded;
    let cartTotal = 0;

    if (payload._id) {
        data.userId = payload._id;
        data.createdAt = new Date();

        [eErr, inactiveRes] = await to(User.findOne({ _id: data.shopkeeperId, account_activate: { $ne: "active" } }));
        if (inactiveRes && inactiveRes !== undefined && inactiveRes._id && inactiveRes._id !== undefined) {
            return ReE(res, { msg: "Shop is not active anymore" }, 422);
        }

        if (data.shopkeeperId && data.productId) {

            [pErr, pData] = await to(Product.findOne({ _id: data.productId }));
            if (pErr) { return ReE(res, { msg: "An error occured", error: pErr }, 422); }
            if (pData.inStock !== undefined && pData.inStock < data.quantity) { if (pData.inStock === 0) { return ReE(res, { msg: pData.title + " is out of stock" }, 422); } else { return ReE(res, { msg: "Only " + pData.inStock + " quantity is available for " + pData.title }, 422); } }
            if (pData.inStock !== undefined && pData.inStock < 1) { return ReE(res, { msg: "Product is out of stock" }, 422); }
            if (pData && pData.salePrice) {
                cartTotal = cartTotal + (pData.salePrice * data.quantity);
                //if(pData.salePrice*data.quantity > 150){ return ReE(res, { msg: "Cart total can not exceed $150" }, 422); }
            }
            else if (pData && pData.regularPrice) {
                cartTotal = cartTotal + (pData.regularPrice * data.quantity);
                //if(pData.regularPrice*data.quantity > 150){ return ReE(res, { msg: "Cart total can not exceed $150" }, 422); }
            }



            //remove product from cart if it is from another shop
            // also count cart total
            await to(Cart.find({ userId: payload._id }).then(async (cartProducts) => {
                if (cartProducts && cartProducts.length > 0) {
                    for (const prduct of cartProducts) {
                        let newShopkepr = mongoose.Types.ObjectId(data.shopkeeperId);
                        if (newShopkepr.equals(prduct.shopkeeperId)) {
                            [prErr, proData] = await to(Product.findOne({ _id: prduct.productId }));
                            if (prErr) { return ReE(res, { msg: "An error occured", error: prErr }, 422); }
                            if (proData && proData.salePrice) {
                                cartTotal = cartTotal + (proData.salePrice * prduct.quantity);
                            }
                            else if (proData && proData.regularPrice) {
                                cartTotal = cartTotal + (proData.regularPrice * prduct.quantity);
                            }

                        }
                        else {
                            if (data.forceNewShop !== undefined && data.forceNewShop === true) { await to(Cart.deleteOne({ _id: prduct._id })); }
                            else { return ReE(res, { msg: "You are moving to order from a different shop", errors: "You are moving to order from a different shop" }, 422); }
                        }
                    }
                }
            }));


            //if(cartTotal > 150){ return ReE(res, { msg: "Cart total can not exceed $150" }, 422); }
            /*++++++++Done By Cis Developer+++++++++++*/
            let flag = false;
            if (data.addons.length > 0) {
                Cart.find({ $and: [{ userId: payload._id }, { productId: data.productId }, { addons: { "$not": { "$size": 0 } } }] }).then((response) => {

                    if (response.length > 0) {
                        for (let index = 0; index < response.length; index++) {
                            const element = response[index];
                            const isEqual = (data.addons.length === element.addons.length) && (data.addons.every(val => element.addons.includes(val)));
                            if (isEqual) {
                                const quantity = element.quantity + data.quantity;
                                Cart.findOneAndUpdate({ _id: element._id }, { $set: { quantity: quantity } }, function (err, updatedCart) {
                                    if (err) { return ReE(res, { msg: "An error occured", errors: err }, 422); }
                                    else {

                                        return ReS(res, { msg: "Product added successfully" });
                                    }
                                });
                                break;
                            } else {
                                if (response.length == index + 1) {
                                    Cart.create(data).then(_addresponse => {
                                        return ReS(res, { data: _addresponse });
                                    }).catch(err => {
                                        return ReE(res, { msg: "", errors: err }, 422);
                                    })
                                }
                            }
                        }

                    } else {
                        Cart.create(data).then(_addresponse => {
                            return ReS(res, { data: _addresponse });
                        }).catch(err => {
                            return ReE(res, { msg: "", errors: err }, 422);
                        })
                    }


                }).catch(err => {
                    return ReE(res, { msg: "", errors: err }, 422);
                })
            } else {
                Cart.findOne({ userId: payload._id, productId: data.productId, addons: { $size: 0 } }).then((response) => {
                    if (response) {
                        /*++++++++Done By Cis Developer+++++++++++*/
                        const quantity = response.quantity + data.quantity;
                        /*++++++++Done By Cis Developer+++++++++++*/
                        Cart.findOneAndUpdate({ userId: payload._id, productId: data.productId, addons: { $size: 0 } }, { $set: { quantity: quantity } }, function (err, updatedCart) {
                            if (err) { return ReE(res, { msg: "An error occured", errors: err }, 422); }
                            else {

                                return ReS(res, { msg: "Product added successfully" });
                            }
                        });
                    }
                    else {
                        //add product in cart with full object here
                        Cart.create(data).then(_addresponse => {
                            return ReS(res, { data: _addresponse });
                        }).catch(err => {
                            return ReE(res, { msg: "", errors: err }, 422);
                        })
                    }
                }).catch(err => {
                    return ReE(res, { msg: "", errors: err }, 422);
                })
            }

        } else {
            return ReE(res, { msg: "Validation Failed", errors: "shopkeeperId, productId and price is required" }, 422);
        }
    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }

}

/*---------------------------------*/
// function to re order product cart
/*---------------------------------*/
exports.reOrderProducts = async function (req, res) {
    var data = req.body.products;
    var mainData = req.body;
    const payload = req.decoded;
    let outOfStock = 0;

    if (payload._id) {

        var allProduct = [];

        for (const element of data) {
            //check for stock availability
            [pErr, pData] = await to(Product.findOne({ _id: element.productId }));

            if (pData.shopkeeperId !== undefined) {
                [eErr, inactiveRes] = await to(User.findOne({ _id: pData.shopkeeperId, account_activate: { $ne: "active" } }));
                if (inactiveRes && inactiveRes !== undefined && inactiveRes._id && inactiveRes._id !== undefined) {
                    return ReE(res, { msg: "Shop is not active anymore" }, 422);
                }
            }


            if (pData.inStock !== undefined && pData.inStock < data.quantity) { if (pData.inStock === 0) { return ReE(res, { msg: pData.title + " Product is out of stock" }, 422); } else { return ReE(res, { msg: "Only " + pData.inStock + " quantity is available for " + pData.title }, 422); } }
            if (pData.inStock !== undefined && pData.inStock < 1) { outOfStock++; }
            else {

                [sErr, sRes] = await to(Shop.findOne({ ownerId: element.shopkeeperId }));
                if (sRes !== undefined && sRes) {
                    if (sRes.address) {
                        let shopLat = sRes.address.lat;
                        let shopLong = sRes.address.long;
                        if (mainData.lat !== undefined &&
                            mainData.long !== undefined &&
                            mainData.lat !== "" &&
                            mainData.long !== "") {

                            //get shop distance from cutomer if reorder
                            new Promise(function (resolve, reject) {
                                try {
                                    distance.get({
                                        index: 1,
                                        origin: shopLat + "," + shopLong,
                                        destination: mainData.lat + "," + mainData.long
                                    },
                                        function (err, distncedata) {
                                            if (distncedata && distncedata.distanceValue) {
                                                if ((distncedata.distanceValue / 1000) <= process.env.NEAR_SHOP_RANGE) { }
                                                else { return ReE(res, { msg: "Shop is not your range" }, 422); }
                                            }
                                        });
                                } catch (e) {
                                    reject();
                                    console.log("error occured in re order");                                    
                                }
                            });

                        }
                    }
                }





                if (pData && pData._id) {
                    element.productId;
                    element.shopkeeperId;
                    element.userId = payload._id;
                    element.createdAt = new Date();
                    allProduct.push(element);
                } else { outOfStock++; }
            }
        }

        // if total out of stock is equal to re-order product
        if (outOfStock === data.length) { return ReE(res, { msg: "All the product of this order is out of stock" }, 422); }


        var userId = mongoose.Types.ObjectId(payload._id);
        Cart.deleteMany({ userId: userId }).then(async function (ressss) {
            if (allProduct.length > 0) {

                Cart.insertMany(allProduct).then(_addresponse => {
                    return ReS(res, { data: _addresponse, productOrdered: data.length, outOfStock: outOfStock });
                }).catch(err => {
                    return ReE(res, { msg: "An error occured", errors: err }, 422);
                })

            } else {
                return ReE(res, { msg: "An error occred" }, 422);
            }
        }).catch(function (error) {
            return ReE(res, { msg: "An error occured", errors: error }, 422);
        });






    } else {
        return ReE(res, { msg: "Unauthorised access" }, 422);
    }
}

/*---------------------------------*/
// get user full cart by it's id
/*---------------------------------*/
exports.getCartDetailByUserId = async function (req, res) {
    const payload = req.decoded;
    var postData = req.body;
    var holder = [];
    var totalAmount = 0;
    var totalServiceCharge = 0;
    var deliveryCharge = 0;
    var totalTax = 0;
    var country = '';
    var codDelCharge = 0;

    

    const options = {
        provider: 'google',
        apiKey: process.env.MAP_KEY,
        formatter: null
    };
    const geocoder = NodeGeocoder(options);

    // Using callback ,
    if (postData.lat !== undefined && postData.long !== undefined) {
        const addresRes = await geocoder.reverse({ lat: postData.lat, lon: postData.long });
        if (addresRes !== undefined) {
            country = addresRes[0].countryCode;
        }
    }
    let totalAddonAmout = 0
    if (payload._id) {
        Cart.find({ userId: payload._id }).populate('productId').populate({
            path: 'addons',
            model: "Addons"
        }).lean().then(async data => {

            [tErr, tRes] = await to(TaxSet.find({}));

            for (const element of data) {
                var thisProduct = element.productId;
                let addonsPrice = 0;
                var payable_amount = 0;

                //get shop data
                [sErr, sRes] = await to(Shop.findOne({ ownerId: element.shopkeeperId }));
                if (sRes !== undefined && sRes && sRes.codDeliveryCharge !== undefined) { codDelCharge = sRes.codDeliveryCharge; }
                //addons price calculation
                if (element.addons !== undefined &&
                    element.addons !== null &&
                    element.addons.length > 0) {
                    [aErr, aRes] = await to(Addons.find({ _id: { $in: element.addons } }));
                    if (aRes !== undefined && aRes && aRes.length > 0) {
                        for (const addons of aRes) {
                            if (addons.addonPrice !== undefined && addons.addonPrice && addons.addonPrice !== 0) {
                                addonsPrice = addonsPrice + (parseFloat(addons.addonPrice));
                            }
                        }
                    }
                }

                //price get first
                // if (thisProduct.salePrice && thisProduct.salePrice !== '') { payable_amount = ((thisProduct.salePrice + addonsPrice) * element.quantity); }
                // else { payable_amount = (thisProduct.regularPrice + addonsPrice) * element.quantity; }

                if (thisProduct.salePrice && thisProduct.salePrice !== '') { payable_amount = ((thisProduct.salePrice ) * element.quantity); }
                else { payable_amount = (thisProduct.regularPrice ) * element.quantity; }

                if (thisProduct &&
                    thisProduct.discountApplied &&
                    thisProduct.discountApplied !== null &&
                    thisProduct.discountApplied !== undefined
                ) {
                    //if product has an discount already then calculate payable amount aqccording to that
                    await to(Discount.findOne({ _id: element.productId.discountApplied }).then((response) => {
                        if (response) {
                            var date1 = new Date(response.expiry);
                            var date2 = new Date();
                            var Difference_In_Time = date1.getTime() - date2.getTime();
                            var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);

                            if (Difference_In_Days > 0 && response.status == "1") {
                                let product = element.productId;
                                if (response.discountType == "percentage") { payable_amount = payable_amount - ((payable_amount * response.discountValue) / 100); }
                                else if (response.discountType == "flat") { payable_amount = payable_amount - (response.discountValue * element.quantity); }
                            }
                        }
                    }));
                    totalAddonAmout = totalAddonAmout+ (addonsPrice* element.quantity);
                    if (payable_amount > 0) {
                        element.discountedPrice = payable_amount + (addonsPrice* element.quantity);
                        if (addonsPrice > 0) { element.priceAfterAddons = payable_amount + (addonsPrice* element.quantity); }
                        totalAmount = totalAmount + payable_amount+ (addonsPrice* element.quantity);
                    } else {
                        totalAmount = totalAmount + payable_amount+ (addonsPrice* element.quantity);
                        if (addonsPrice > 0) { element.priceAfterAddons = payable_amount+ (addonsPrice* element.quantity); }
                    }
                } else { 
                    totalAmount = totalAmount + payable_amount+ (addonsPrice* element.quantity);
                    if (addonsPrice > 0) { element.priceAfterAddons = payable_amount+ (addonsPrice* element.quantity); } 
                }
                holder.push(element);
            }

            if (totalAmount > 0) {
                let serviceCharge = parseFloat(process.env.PERCENT_SERVICE_CHARGE_CUSTOMER_PAYS);
                let minServiceCharge = parseFloat(process.env.MIN_SERVICE_CHARGE_CUSTOMER_PAYS);
                let delPercCharge = parseFloat(process.env.PERCENT_OF_SERVICE_CHARGE_FOR_DELIVERY);
                let minDelCharge = parseFloat(process.env.MIN_DELIVERY_PAID);

                totalServiceCharge = (totalAmount * serviceCharge) / 100;
                if (totalServiceCharge < minServiceCharge) { totalServiceCharge = minServiceCharge }
                totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));

                deliveryCharge = (totalServiceCharge * delPercCharge) / 100;
                if (deliveryCharge < minDelCharge) { deliveryCharge = minDelCharge }
                deliveryCharge = parseFloat(deliveryCharge.toFixed(2));
                
                if (country !== '' && country && tRes !== undefined && tRes.length > 0) {
                    for (const taxes of tRes) {

                        if (taxes.countryCode === country) {                            
                            if (taxes.taxType === 'flat') { totalTax = taxes.taxValue; }
                            if (taxes.taxType === 'percentage') { totalTax = (totalAmount * taxes.taxValue) / 100; }
                        }
                    }
                }
            }
             
            return ReS(res, { data: holder, totalAmount: totalAmount, shopCodDeliveryCharge: codDelCharge, serviceCharge: totalServiceCharge, deliveryCharge: deliveryCharge, totalTax: totalTax, totalNeedToPay: parseFloat((totalServiceCharge + totalAmount + totalTax).toFixed(2)) });
        });

    }
    else {
        return ReE(res, { msg: "Validation Failed", errors: "userId is required" }, 422);
    }
}

/*---------------------------------*/
// update product qty in cart
/*---------------------------------*/
exports.changeCartProductCount = async function (req, res) {
    const payload = req.decoded;
    var data = req.body;
    if (payload._id) {
        var upCartObj = {};
        upCartObj.quantity = data.quantity;
        upCartObj.updatedAt = new Date();

        Cart.findOne({ _id: data.cartId }, async function (err, getCart) {
            if (err) { return ReE(res, { msg: "Failed to updated product quantity", errors: err }, 422); }

            if (getCart !== undefined && getCart.productId !== undefined && getCart.productId) {
                [pErr, pData] = await to(Product.findOne({ _id: getCart.productId }));
                if (pData.inStock !== undefined && pData.inStock < data.quantity) { if (pData.inStock === 0) { return ReE(res, { msg: pData.title + " is out of stock" }, 422); } else { return ReE(res, { msg: "Only " + pData.inStock + " quantity is available for " + pData.title }, 422); } }
            }

            Cart.findOneAndUpdate({ _id: data.cartId }, { $set: upCartObj }, { new: true }, function (err, updatedCart) {
                if (err) {
                    return ReE(res, { msg: "Validation Failed", errors: err }, 422);
                } else {
                    exports.getCartDetailByUserId(req, res);
                    //return ReS(res, { data: updatedCart });
                }
            });
        });

    }
}

/*---------------------------------*/
// delete product from cart
/*---------------------------------*/
exports.deleteProductFromCart = function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {
        Cart.deleteOne({ _id: postData.cartId, userId: payload._id }, function (err) {
            if (err) { return ReE(res, { msg: "Failed", errors: err }, 422); }
            exports.getCartDetailByUserId(req, res);
            //return ReS(res, { msg : 'product from cart deleted!!'  });
        });
    }
}

/*---------------------------------*/
// calculate coupon on cart values
/*---------------------------------*/
exports.cartCalculateCoupon = async function (getCart, response, req) {
    return new Promise(async(resolve, reject) => {
    const postData = req.body;
    let applyCount = 0;
    let totalCouponOffer = 0;
    let cnttr = 0
    var resObj = {};
    let totalAmount = 0;
    let totalServiceCharge = 0;
    let deliveryCharge = 0;
    var totalTax = 0;
    var country = '';
    var codDelCharge = 0;
    var totalAddonAmout = 0;
    let addonsPrice = 0;  
    let forDifference = 0; 

    // step 1    
    const options = {
        provider: 'google',
        apiKey: process.env.MAP_KEY,
        formatter: null
    };
    const geocoder = NodeGeocoder(options);

    // Using callback ,
    if (postData.lat !== undefined && postData.long !== undefined) {
        const addresRes = await geocoder.reverse({ lat: postData.lat, lon: postData.long });
        if (addresRes !== undefined) {
            country = addresRes[0].countryCode;
        }
    }

    [tErr, tRes] = await to(TaxSet.find({}));


    // step 2
    let i = -1;
      var next = async() => {
        i++;
        let thisProRemainingPrice = 0;
        let mainPrice = 0;    
        
       
        if (i < getCart.length) 
        {

            /*get original price*/
            let price = 0;
            if (getCart[i].productId.salePrice) { price = getCart[i].productId.salePrice*getCart[i].quantity; }
            else if (getCart[i].productId.regularPrice) { price = getCart[i].productId.regularPrice*getCart[i].quantity; }
            else { }
            let oldp = price;

            /*calculate addons*/
            
            if (getCart[i].addons !== undefined &&
                    getCart[i].addons !== null &&
                    getCart[i].addons.length > 0)
            {
                for (const addons of getCart[i].addons) {
                    if (addons.addonPrice !== undefined && addons.addonPrice) {
                        addonsPrice = addonsPrice + (parseFloat(addons.addonPrice*getCart[i].quantity));
                    }
                }
            }
           

            //check category if applicable on categories
            if(response.categories.indexOf(getCart[i].productId.categories) !== -1 && response.productMinPrice <= price )
            {
                 //calculate the shop own product discounts
                 if (getCart[i].productId.discountApplied !== null) 
                 {
                    var discountid = mongoose.Types.ObjectId(getCart[i].productId.discountApplied);
                    [errDisc, discountRes] = await to(Discount.findOne({ _id: discountid }));
                    if (discountRes._id) {

                        var date1 = new Date(discountRes.expiry);
                        var date2 = new Date();
                        var Difference_In_Time = date1.getTime() - date2.getTime();
                        var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);


                        if (Difference_In_Days > 0 && discountRes.status == "1") {
                            if (discountRes.discountType == "percentage") { price = (price - ((price * discountRes.discountValue) / 100)); }
                            else if (discountRes.discountType == "flat") { price = (price - (discountRes.discountValue*getCart[i].quantity)); }
                        }
                    }
                 }

                 oldp = price;
                 /*update cart to apply coupon object*/
                 let upCartObj = {};
                 upCartObj.couponApplied = response._id;
                
                 /*if coupon is created by  shop*/
                 if (response.shopkeeperId !== undefined && response.shopkeeperId !== null) 
                 {
                     let newShopkepr = mongoose.Types.ObjectId(response.shopkeeperId);                     
                     if (newShopkepr.equals(getCart[i].productId.shopkeeperId)) {
                        /* if this product is from the same shop coupon created BY */
                        [cartErr, cartRes] = await to(Cart.findOneAndUpdate({ _id: getCart[i]._id }, { $set: upCartObj }));
                        applyCount++;
                        if (response.couponType == "Percent"){ price = (price - ((price * response.couponValue) / 100)); }
                        else if(response.couponType == "flat"){ price = (price - response.couponValue);  }
                        else{ }

                     }
                 }else{
                        [cartErr, cartRes] = await to(Cart.findOneAndUpdate({ _id: getCart[i]._id }, { $set: upCartObj }));
                        applyCount++;
                        if (response.couponType == "Percent"){ price = (price - ((price * response.couponValue) / 100)); }
                        else if(response.couponType == "flat"){ price = (price - response.couponValue);  }
                        else{ }
                      }

                forDifference = forDifference+(oldp-price);
                //forDifference = forDifference+(oldp-price);
                totalAmount = totalAmount+price;
            }
            else{
                    totalAmount = totalAmount+price;                    
                    forDifference = forDifference+(oldp-price);
                   
                }
            next();
        }
        else {
        totalAmount = totalAmount + addonsPrice;
        if (totalAmount > 0) {
            let serviceCharge = parseFloat(process.env.PERCENT_SERVICE_CHARGE_CUSTOMER_PAYS);
            let minServiceCharge = parseFloat(process.env.MIN_SERVICE_CHARGE_CUSTOMER_PAYS);
            let delPercCharge = parseFloat(process.env.PERCENT_OF_SERVICE_CHARGE_FOR_DELIVERY);
            let minDelCharge = parseFloat(process.env.MIN_DELIVERY_PAID);

            totalServiceCharge = (totalAmount * serviceCharge) / 100;
            if (totalServiceCharge < minServiceCharge) { totalServiceCharge = minServiceCharge }
            totalServiceCharge = parseFloat(totalServiceCharge.toFixed(2));

            deliveryCharge = (totalServiceCharge * delPercCharge) / 100;
            if (deliveryCharge < minDelCharge) { deliveryCharge = minDelCharge }
            deliveryCharge = parseFloat(deliveryCharge.toFixed(2));

            if (country !== '' && country && tRes !== undefined && tRes.length > 0) {
                for (const taxes of tRes) {
                    if (taxes.countryCode === country) {
                        if (taxes.taxType === 'flat') { totalTax = taxes.taxValue; }
                        if (taxes.taxType === 'percentage') { totalTax = (totalAmount * taxes.taxValue) / 100; }
                    }
                }
            }
        }
       
        resObj.productApplied = applyCount;
        resObj.priceOffer = parseFloat(forDifference.toFixed(2));
        resObj.productTotalOnly = totalAmount;
        resObj.totalServiceCharge = totalServiceCharge;
        resObj.deliveryCharge = deliveryCharge;
        resObj.totalTax = totalTax;
        resObj.totalNeedToPay = parseFloat((totalServiceCharge + totalAmount + totalTax).toFixed(2))        
        resolve(resObj);
        }
    }

    next();

})

 
}

/****************************/
//apply coupon on cart page
/***************************/
exports.applyCoupon = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {
        var count = (input, arr) => arr.filter(x => x === input).length;


        await to(Cart.updateMany({ userId: payload._id }, { $set: { couponApplied: null } }));
        const searchString = new RegExp(postData.couponId, "i");

        [errs, CoupRes] = await to(Coupon.findOne({ coupon_token: searchString }).then(async (response) => {
            if (response) {

                if (response.holdUsers !== undefined && response.holdUsers.length > 0) {
                    if (count(payload._id, response.holdUsers) >= response.validTime) { return ReE(res, { msg: "Coupon is only valid for " + response.validTime + " time." }, 422); }
                }

                var date1 = new Date(response.expiry);
                var date2 = new Date();
                var Difference_In_Time = date1.getTime() - date2.getTime();
                var Difference_In_Days = Difference_In_Time / (1000 * 3600 * 24);
                if (Difference_In_Days > 0 && response.status == "active") {

                    [errC, resCart] = await to(Cart.find({ userId: payload._id }).populate("productId").populate({ path: 'addons', model: "Addons" }));
                    if (errC) { return ReE(res, { msg: "An error occured", errors: err }, 422); }
                    if (resCart && resCart.length > 0) {
                        let cartCategories = [];
                        /*==========Done By Cis Developer=================*/
                        /* Getting Categories Of Cart Element*/
                        for (let index = 0; index < resCart.length; index++) {
                            const element = resCart[index];
                            if (!cartCategories.includes(element.productId.categories.toString())) {
                                cartCategories.push(element.productId.categories.toString());
                            }
                        }
                        /*==========Done By Cis Developer=================*/
                        if (response.categories.length > 0 && cartCategories.length > 0) {
                            for (let index = 0; index < response.categories.length; index++) {
                                const element = response.categories[index].toString();
                                if (cartCategories.includes(element)) {                                    
                                    break;
                                } else {
                                    if (response.categories.length === (index + 1)) {
                                        return ReE(res, { msg: "This Coupon Is Not Applicable On This Product" }, 422);
                                    }
                                }
                            }
                        }                        
                        /*==========Done By Cis Developer=================*/
                        [ers, cartCalRes] = await to(exports.cartCalculateCoupon(resCart, response, req));                        
                        if (ers) { return ReE(res, { msg: "Error processing request" }, 422); }
                        
                        if (cartCalRes.totalNeedToPay < response.productMinPrice) {

                            return ReE(res, { msg: "Total Amount is Less" }, 422);
                        } else {
                            return ReS(res, { data: cartCalRes });
                        }


                    } else { return ReS(res, { msg: "No product in cart" }); }

                } else {
                    return ReE(res, { msg: "Coupon expired or not active" }, 422);
                }
            }
            else {
                return ReE(res, { msg: "No coupon found", errors: err }, 422);
            }
        }).catch(err => {
            return ReE(res, { msg: "No coupon found", errors: err }, 422);
        })
        );



    }
}

/****************************************/
// remove coupon from cart
/****************************************/
exports.removeCoupon = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload._id) {
        [err, ress] = await to(Cart.updateMany({ userId: payload._id }, { $set: { couponApplied: null } }));
        if (err) { return ReE(res, { msg: "Unable to process your entry", errors: err }, 422); }
        return ReS(res, { msg: "Coupon removed successfully" });
    } else { return ReE(res, { msg: "Unauthorised access" }, 422); }
}


module.exports = exports;
