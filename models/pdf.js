const mongoose=require('mongoose')

const Schema= mongoose.Schema
const User= require('./user')

const pdfSchema= new Schema({
    name:{
        type:String
    },
    Educ:{
        type:String
    },
    Projects:{
        type:String
    },
    date:{
        type:Date
    }
})

module.exports=mongoose.model('Pdf',pdfSchema)