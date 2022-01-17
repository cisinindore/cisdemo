var mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
var fs = require("fs");
var async = require("async");

const { check, body } = require('express-validator');
const passwordService = require("../services/password_service");
const { to, ReS, ReE, ValidationErrors } = require('../services/util.service');
const Product = require("../models/Product.model");
const Shop = require("../models/Shop.model");
const Tag = require("../models/Tag.model");
const Discount = require("../models/Discount.model");
const Addons = require("../models/Addons.model");

const path = require("path");
var ObjectId = require('mongodb').ObjectID;



exports.addProduct = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    if (payload) {

        let prodData = {};

        prodData.title = postData.productTitle;
        prodData.description = postData.productDescription;
        prodData.shopkeeperId = payload._id;
        prodData.regularPrice = postData.productRegularPrice;
        prodData.salePrice = postData.productSalePrice;
        prodData.mainImage = postData.mainImg;
        prodData.imageGallery = postData.imageGallery;
        prodData.categories = postData.productCategories;
        prodData.discountApplied = postData.productDiscount;
        prodData.inStock = postData.productStock;
        prodData.sku = postData.productSku;
        prodData.productSoldIndividually = postData.individualSold;

        if (postData.costPerItem) { prodData.costPerItem = postData.costPerItem; }
        if (postData.productBarcode) { prodData.barcode = postData.productBarcode; }
        prodData.productAttributes = postData.productAttributes;
        prodData.createdAt = new Date();

        //add addons if received from UI
        var addonHolder = [];
        if(postData.addOnList !== undefined && postData.addOnList){
          for(const addon of postData.addOnList){
            if(addon.add_on_label !=='' && addon.add_on_price !==''){
              //addonHolder.push({addonTitle : addon.add_on_label, addonPrice : parseFloat(addon.add_on_price) })
              [aErr, aRes] = await to (Addons.create({ addonTitle : addon.add_on_label, addonPrice : parseFloat(addon.add_on_price) }) )
              if(aRes && aRes._id){ addonHolder.push(aRes._id); }
            }
          }
        }

        prodData.addons = addonHolder;

        if (postData.tags) {
            var idArray = [];
            await Tag.find({ title: { $in: postData.tags } }).exec((err, tagData) => {
                if (tagData.length > 0) {
                    tagData.map((tgD, index) => {
                        idArray.push(tgD._id);
                    })
                }
                prodData.tags = idArray;

                // save product data into product collection
                Product.create(prodData, async function (err, insertedProduct) {
                    if (err) { return ReE(res, { msg: "Validation Failed", errors: err }, 422); }
                    else {
                      if(addonHolder.length>0){
                        for( const addons of addonHolder){
                          [uaErr, uaRes]  = await to ( Addons.findOneAndUpdate({ _id: addons }, { $set: { productId : insertedProduct._id } }, { new: true }) );
                        }
                      }
                      return ReS(res, { data: insertedProduct, type: "product inserted" });
                    }
                });
            });
        } else {
            // save product data into product collection
            Product.create(prodData, async function (err, insertedProduct) {
                if (err) { return ReE(res, { msg: "Validation Failed", errors: err }, 422); }
                else {
                  if(addonHolder.length>0){
                    for( const addons of addonHolder){
                      [uaErr, uaRes]  = await to ( Addons.findOneAndUpdate({ _id: addons }, { $set: { productId : insertedProduct._id } }, { new: true }) );
                    }
                  }
                  return ReS(res, { data: insertedProduct, type: "product inserted" });
                }
            });
        }


    }
}

//-- Copy existing product
exports.copyProduct = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;
    return 'nilesh';
    // if(payload){

    // let prodData = {};

    // prodData.title        =  postData.productTitle;
    // prodData.description  =  postData.productDescription;
    // prodData.shopkeeperId =  payload._id;
    // prodData.regularPrice =  postData.productRegularPrice;
    // prodData.salePrice    =  postData.productSalePrice;
    // prodData.mainImage    =  postData.mainImg;
    // prodData.imageGallery =  postData.imageGallery;
    // prodData.categories   =  postData.productCategories;
    // prodData.discountApplied = postData.productDiscount;
    // prodData.inStock      =  postData.productStock;
    // prodData.sku          =  postData.productSku;
    // prodData.productSoldIndividually =  postData.individualSold;

    // if(postData.costPerItem){ prodData.costPerItem = postData.costPerItem; }
    // if(postData.productBarcode){  prodData.barcode = postData.productBarcode; }
    // prodData.productAttributes = postData.productAttributes;
    // prodData.createdAt = new Date();
    // if(postData.tags){
    //     var idArray = [];
    //    await Tag.find( { title: { $in: postData.tags } } ).exec((err, tagData) => {
    //         if( tagData.length > 0 ){
    //             tagData.map( (tgD, index) => {
    //                 idArray.push(tgD._id);
    //             })
    //         }
    //         prodData.tags = idArray;

    //         // save product data into product collection
    //         Product.create(prodData, function (err, insertedProduct) {
    //             if (err){
    //                 return ReE(res, { msg: "Validation Failed", errors: err }, 422);
    //             } else { return ReS(res, { data: insertedProduct, type : "product inserted" }); }
    //         });
    //     });
    //  } else{
    //             // save product data into product collection
    //             Product.create(prodData, function (err, insertedProduct) {
    //                 if (err){
    //                     return ReE(res, { msg: "Validation Failed", errors: err }, 422);
    //                 } else { return ReS(res, { data: insertedProduct, type : "product inserted" }); }
    //             });
    //         }


    // }
}

//get all the product for this shopkeeper
exports.getShopkeeperProduct = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload) {
        var id = mongoose.Types.ObjectId(payload._id);

        const allProdCount = await Product.collection.find({ shopkeeperId: id }).count();


        var offsetRecord = (postData.page - 1) * postData.perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * postData.perPage;
        }



        Product.aggregate([
            {
                $match: {
                    $and: [{ shopkeeperId: id }]
                },
            },
            { $skip: offsetRecord }, { $limit: postData.perPage },
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
            }

        ], (err, allData) => {
            if (err) {
                next(err);
                return;
            }

            var reminder = allProdCount % postData.perPage;
            var totalPages = parseInt(allProdCount / postData.perPage);
            if (reminder > 0) {
                totalPages++;
            }
            var pagination = {
                totalCount: allProdCount,
                totalPages: totalPages,
                currentPage: postData.page
            };

            return ReS(res, { allData, pagination: pagination, type: 'get-product' });


        });
    }

}

exports.getSingleProductForShopkeeper = async function (req, res, next) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload) {

        var id = mongoose.Types.ObjectId(payload._id);
        var productId = mongoose.Types.ObjectId(postData.productId);

        Product.find({ _id: productId }).populate('categories')
        .populate({
          path : 'tags',
          model : "Tag"})
          .populate({
            path : 'addons',
            model : "Addons"
        }).lean().then( async productData => {
            console.log("get product--------", productData[0].addons);
            return ReS(res, { productData, type: 'get-single-product' });
        })


        // Product.aggregate([
        //     {
        //         $match: {
        //             $and: [{ _id: productId }]
        //         },
        //     },
        //     {
        //         $lookup:
        //         {
        //             from: "categories",
        //             let: { categories: "$categories" },
        //             pipeline: [
        //                 {
        //                     $match:
        //                     {
        //                         $expr:
        //                         {
        //                             $and:
        //                                 [
        //                                     { $eq: ["$_id", "$$categories"] },
        //                                 ]
        //                         }
        //                     }
        //                 },
        //             ],
        //             as: "categoryData"
        //         }
        //     },
        //     {
        //         $lookup:
        //         {
        //             from: "tags",
        //             let: { tag: "$tags" },
        //             pipeline: [
        //                 {
        //                     $match:
        //                     {
        //                         $expr:
        //                         {
        //                             $and:
        //                                 [
        //                                     { $in: ["$_id", "$$tag"] },
        //                                 ]
        //                         }
        //                     }
        //                 },
        //             ],
        //             as: "tagData"
        //         }
        //     },
        //     {
        //         $lookup:
        //         {
        //             from: "addons",
        //             let: { addons: "$addons" },
        //             pipeline: [
        //                 {
        //                     $match:
        //                     {
        //                         $expr:
        //                         {
        //                             $and:
        //                                 [
        //                                     { $in: ["$_id", "$$addons"] },
        //                                 ]
        //                         }
        //                     }
        //                 },
        //             ],
        //             as: "addons"
        //         }
        //     }
        // ], (err, productData) => {
        //     if (err) {
        //         next(err);
        //         return;
        //     }
        //     console.log(productData);
        //     return ReS(res, { productData, type: 'get-single-product' });
        //
        //
        // });

    }
}


// update product with the data sent by client
exports.updateProductByShopkeeper = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload) {

        // editingProdId,
        const productObj = {};

        productObj.title = postData.productTitle;
        productObj.description = postData.productDescription;
        productObj.regularPrice = postData.productRegularPrice;
        productObj.salePrice = postData.productSalePrice;
        if (postData.productCategories && postData.productCategories !== '----') { productObj.categories = postData.productCategories; }
        else { productObj.categories = null; }

        if (postData.productDiscount && postData.productDiscount !== '----') { productObj.discountApplied = postData.productDiscount; }
        else { productObj.discountApplied = null; }

        productObj.inStock = postData.productStock;
        productObj.sku = postData.productSku;
        productObj.productSoldIndividually = postData.individualSold;
        productObj.mainImage = postData.mainImg;
        productObj.imageGallery = postData.imageGallery;
        productObj.updatedAt = new Date();

        if (postData.costPerItem) { productObj.costPerItem = postData.costPerItem; }
        if (postData.productBarcode) { productObj.barcode = postData.productBarcode; }
        productObj.productAttributes = postData.productAttributes;


        var productId = mongoose.Types.ObjectId(postData.editingProdId);


        //add addons if received from UI
        var addonHolder = [];
        if(postData.addOnList !== undefined && postData.addOnList){
          for(const addon of postData.addOnList){
            if(addon.add_on_label !=='' && addon.add_on_price !==''){
              //addonHolder.push({addonTitle : addon.add_on_label, addonPrice : parseFloat(addon.add_on_price) })
              [aErr, aRes] = await to (Addons.create({ addonTitle : addon.add_on_label, addonPrice : parseFloat(addon.add_on_price) }) )
              if(aRes && aRes._id){ addonHolder.push(aRes._id); }
            }
          }
        }


        if(postData.oldUpdatedAddons !== undefined && postData.oldUpdatedAddons && postData.oldUpdatedAddons.length > 0 ){
          for( let oldAddons of postData.oldUpdatedAddons){
            let obj = {};
            obj.addonTitle = oldAddons.addonTitle;
            obj.addonPrice = oldAddons.addonPrice;
            obj.updatedAt  = new Date();
            [uaErr, uaRes]  = await to ( Addons.findOneAndUpdate({ _id: oldAddons._id }, { $set: obj }, { new: true }) );
            if(uaRes && uaRes._id !== undefined ){ addonHolder.push(uaRes._id); }
          }
        }


        if(postData.removedAddon !== undefined && postData.removedAddon && postData.removedAddon.length > 0 ){
          for( let removedAddon of postData.removedAddon){
            [uaErr, uaRes]  = await to ( Addons.remove({ _id: removedAddon }) );
          }
        }






        productObj.addons = addonHolder;


        if (postData.tags) {
            var idArray = [];
            await Tag.find({ title: { $in: postData.tags } }).exec((err, tagData) => {
                if (tagData.length > 0) {
                    tagData.map((tgD, index) => {
                        idArray.push(tgD._id);
                    })
                }
                productObj.tags = idArray;

                // update product data into product collection
                Product.findOneAndUpdate({ _id: productId }, { $set: productObj }, { new: true }, async function (err, updatedProduct) {
                    if (err) {
                        return ReE(res, { msg: "Validation Failed", errors: err }, 422);
                    } else {

                      if(addonHolder.length>0){
                        for( const addons of addonHolder){
                          [uaErr, uaRes]  = await to ( Addons.findOneAndUpdate({ _id: addons }, { $set: { productId : updatedProduct._id } }, { new: true }) );
                        }
                      }
                        return ReS(res, { updatedProduct, type: 'product-updated' });


                    }
                });
            });
        } else {
            productObj.tags = [];
            Product.findOneAndUpdate({ _id: productId }, { $set: productObj }, { new: true }, async function (err, updatedProduct) {
                if (err) {
                    return ReE(res, { msg: "Validation Failed", errors: err }, 422);
                } else {
                    if(addonHolder.length>0){
                      for( const addons of addonHolder){
                        [uaErr, uaRes]  = await to ( Addons.findOneAndUpdate({ _id: addons }, { $set: { productId : updatedProduct._id } }, { new: true }) );
                      }
                    }
                    return ReS(res, { updatedProduct, type: 'product-updated' });


                }
            });

        }



        // Product.findOneAndUpdate({ _id : productId }, { $set : productObj }, {new: true}, function (err, updatedProduct) {
        //     if (err){
        //         return ReE(res, { msg: "Validation Failed", errors: err }, 422);
        //     } else {

        //         return ReS(res, { updatedProduct, type : 'product-updated'  });


        //     }
        //   });




    }
}

// search product for this shopkeeper
exports.searchShopkeeperProduct = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload) {
        var id = mongoose.Types.ObjectId(payload._id);

        var offsetRecord = (postData.page - 1) * postData.perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * postData.perPage;
        }

        const forNumber = parseInt(postData.search);



        const searchString = new RegExp(postData.search, "i");


        Product.aggregate([
            {
                $match: {
                    $and: [
                        {
                            $or: [
                                { title: searchString },
                                { description: searchString },
                                { regularPrice: forNumber },
                                { salePrice: forNumber },
                                { inStock: forNumber },
                                { sku: searchString },
                            ]
                        },
                        {
                            shopkeeperId: id
                        }
                    ]
                }
            },
            { $skip: offsetRecord }, { $limit: postData.perPage },
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
            }

        ], (err, allData) => {
            if (err) {
                next(err);
                return;
            }
            const allProdCount = allData.length;
            var reminder = allProdCount % postData.perPage;
            var totalPages = parseInt(allProdCount / postData.perPage);
            if (reminder > 0) {
                totalPages++;
            }
            var pagination = {
                totalCount: allProdCount,
                totalPages: totalPages,
                currentPage: postData.page
            };

            return ReS(res, { allData, pagination: pagination, type: 'get-product' });


        });
    }

}


exports.deleteShopkeeperProduct = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload) {
        var id = mongoose.Types.ObjectId(postData.productId);
        if (postData.shopkeeperId !== undefined && postData.shopkeeperId) {
            var shopkeeperId = mongoose.Types.ObjectId(postData.shopkeeperId);
        } else { var shopkeeperId = mongoose.Types.ObjectId(payload._id); }

        Product.deleteOne({ _id: id, shopkeeperId: shopkeeperId }, function (err) {
            if (err) { return ReE(res, { msg: "Failed", errors: err }, 422); }
            return ReS(res, { type: 'product-deleted' });
        });
    }
}



// admin pass the shop id and this api will return the products
exports.getShopProductsForShopkeeper = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload) {
      var today = new Date();
      var endDay = new Date("01-01-3000");
        var id = mongoose.Types.ObjectId(postData.shopkeeperId);

        const allProdCount = await Product.collection.find({ shopkeeperId: id }).count();


        var offsetRecord = (postData.page - 1) * postData.perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * postData.perPage;
        }



        Product.aggregate([
            {
                $match: { shopkeeperId: id },
            },
            { $skip: offsetRecord }, { $limit: postData.perPage },
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
                      from: "addons",
                      let: { addons: "$addons" },
                      pipeline: [
                          {
                              $match:
                              {
                                  $expr:
                                  {
                                      $and:
                                          [
                                              {$in: ['$_id', {$ifNull :['$$addons',[]]}]}
                                          ]
                                  }
                              }
                          },
                      ],
                      as: "addonsData"
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
                      from: "ratingreviews",
                      localField: "_id",
                      foreignField: "productId",
                      as: "reviews"
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

        ], (err, allData) => {
            if (err) {
                next(err);
                return;
            }

            var reminder = allProdCount % postData.perPage;
            var totalPages = parseInt(allProdCount / postData.perPage);
            if (reminder > 0) {
                totalPages++;
            }
            var pagination = {
                totalCount: allProdCount,
                totalPages: totalPages,
                currentPage: postData.page
            };

            return ReS(res, { allData, pagination: pagination, type: 'get-product' });


        });
    }

}

// search product by admin for shop
exports.searchProductInShop = async function (req, res) {
    const payload = req.decoded;
    const postData = req.body;

    if (payload) {
        var id = mongoose.Types.ObjectId(postData.shopkeeperId);

        var offsetRecord = (postData.page - 1) * postData.perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * postData.perPage;
        }

        const forNumber = parseInt(postData.search);
        const searchString = new RegExp(postData.search, "i");

        Product.aggregate([
            {
                $match: {
                    $and: [
                        {
                            $or: [
                                { title: searchString },
                                { description: searchString },
                                { regularPrice: forNumber },
                                { salePrice: forNumber },
                                { inStock: forNumber },
                                { sku: searchString },
                            ]
                        },
                        {
                            shopkeeperId: id
                        }
                    ]
                }
            },
            { $skip: offsetRecord }, { $limit: postData.perPage },
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
            }

        ], (err, allData) => {
            if (err) {
                next(err);
                return;
            }
            const allProdCount = allData.length;
            var reminder = allProdCount % postData.perPage;
            var totalPages = parseInt(allProdCount / postData.perPage);
            if (reminder > 0) {
                totalPages++;
            }
            var pagination = {
                totalCount: allProdCount,
                totalPages: totalPages,
                currentPage: postData.page
            };

            return ReS(res, { allData, pagination: pagination, type: 'get-product' });


        });
    }

}



// get product on mobile end
exports.getProducts = async function (req, res, next) {
    const payload = req.decoded;
    const postData = req.body;

    const allProdCount = await Product.collection.find({}).count();
    var offsetRecord = (postData.page - 1) * postData.perPage;
    if (postData.page == 0) {
        offsetRecord = (postData.page) * postData.perPage;
    }

    Product.aggregate([
        { $skip: offsetRecord }, { $limit: postData.perPage },
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
                localField: "discountApplied",
                foreignField: "_id",
                as: "discountData"
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
        if (err) {
            next(err);
            return;
        }
        var reminder = allProdCount % postData.perPage;
        var totalPages = parseInt(allProdCount / postData.perPage);
        if (reminder > 0) {
            totalPages++;
        }
        var pagination = {
            totalCount: allProdCount,
            totalPages: totalPages,
            currentPage: postData.page
        };
        return ReS(res, { allData, pagination: pagination });
    });


}


// get product on mobile end
exports.getShopProducts = async function (req, res, next) {
    const payload = req.decoded;
    const postData = req.body;
    var today = new Date();
    var endDay = new Date("01-01-3000");
    //Shopkeeper id
    var shopkeeprId = mongoose.Types.ObjectId(postData.shopkeeperId);
    //const allProdCount = await Product.collection.find({ shopkeeperId : shopkeeprId }).count();

    var tagId = '';
    var allProdCount;
    var condition;

    if (postData.tags && postData.tags !== '') {
        tagId = mongoose.Types.ObjectId(postData.tags);
        allProdCount = await Product.collection.find({ tags: tagId, shopkeeperId: shopkeeprId }).count();
        condition = { $match: { tags: tagId, shopkeeperId: shopkeeprId } };
    } else {
        allProdCount = await Product.collection.find({ shopkeeperId: shopkeeprId }).count();
        condition = { $match: { shopkeeperId: shopkeeprId } };
    }





    if (allProdCount > 0) {

        var offsetRecord = (postData.page - 1) * postData.perPage;
        if (postData.page == 0) {
            offsetRecord = (postData.page) * postData.perPage;
        }

        Product.aggregate([
            condition,
            { $skip: offsetRecord }, { $limit: postData.perPage },
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
            if (err) {
                next(err);
                return;
            }
            var reminder = allProdCount % postData.perPage;
            var totalPages = parseInt(allProdCount / postData.perPage);
            if (reminder > 0) {
                totalPages++;
            }
            var pagination = {
                totalCount: allProdCount,
                totalPages: totalPages,
                currentPage: postData.page
            };
            return ReS(res, { allData, pagination: pagination });
        });
    } else { return ReS(res, { allData: allProdCount }); }
}

// get product on mobile end
exports.getSingleProduct = async function (req, res, next) {
    const postData = req.body;
    //Shopkeeper id
    var today = new Date();
    var endDay = new Date("01-01-3000");
    var productId = mongoose.Types.ObjectId(postData.productId);

    Product.aggregate([
        {
            $match: {
                $and: [{ _id: productId }]
            },
        },
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
                from: "addons",
                let: { addons: "$addons" },
                pipeline: [
                    {
                        $match:
                        {
                            $expr:
                            {
                                $and:
                                    [
                                        {$in: ['$_id', {$ifNull :['$$addons',[]]}]}
                                    ]
                            }
                        }
                    },
                ],
                as: "addonsData"
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
                from: "ratingreviews",
                localField: "_id",
                foreignField: "productId",
                as: "reviews"
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
        // {
        //     $lookup:
        //     {
        //         from: "discounts",
        //         localField: "discountApplied",
        //         foreignField: "_id",
        //         as: "discountData"
        //     }
        // },
        {
            "$unwind": {
                "path": "$discountData",
                "preserveNullAndEmptyArrays": true
            }
        },

    ], (err, productDetails) => {
        if (err) {
            next(err);
            return;
        }
        let productAllDetail = '';

        productAllDetail = productDetails !== undefined && productDetails[0] !== undefined ? productDetails[0] : "No product found";

        return ReS(res, { productAllDetail });
    });

}


// search product amd shops
exports.searchProductAndShop = async function (req, res, next) {
    const postData = req.body;

    const searchString = new RegExp(postData.search, "i");
    if (postData.search.length > 2) {
        // var offsetRecord = (postData.page-1) * postData.perPage;
        // if( postData.page == 0 ){
        //     offsetRecord = (postData.page) * postData.perPage;
        // }

        [err, product] = await to(Product.aggregate([
            {
                $match: {
                    $or: [
                        { title: searchString },
                        { description: searchString }
                    ]
                }
            },
            {
               $lookup:
                 {
                   from: "shops",
                   localField: "shopkeeperId",
                   foreignField: "ownerId",
                   as: "shopName"
                 }
            },
            { $limit: 30 },
            { $addFields: { listingType: "product" } }
        ], (err, allData) => {
            if (err) {
                next(err);
                return;
            }
            return allData;
        }));


        [err, shops] = await to(Shop.aggregate([
            { $match: { title: searchString } },
            { $limit: 30 },
            { $addFields: { listingType: "shop" } }
        ], (err, allShops) => {
            if (err) {
                next(err);
                return;
            }

            return allShops;
        }));

        var listing = product.concat(shops);
        return ReS(res, { list: listing });
    } else {
        return ReE(res, { msg: "Please enter atleast three characters" }, 422);
    }
}



exports.copyProduct = async function (req, res, next) {
    var id = req.body.id;
    Product.findOne({ _id: new ObjectId(id) }).lean().then(data => {
        if (data) {
            delete data._id;
            data.createdAt = new Date();
            data.updatedAt = new Date();
            Product.create(data).then(resData => {
                return ReS(res, { data: resData });

            }).catch(resRrr => {
                return ReE(res, { msg: "Error in creatig product copy" }, 422);
            })
        }
        else {
            return ReE(res, { msg: "No Product found with the provided id" }, 422);
        }
    }).catch(err => {
        console.log(err, "-----------------------------------------------")
        return ReE(res, { msg: err }, 422);
    })

}

module.exports = exports;
