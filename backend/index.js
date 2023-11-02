const express=require('express')
const bodyparser = require('body-parser')
const stripe=require('stripe')('sk_test_51NzduCChmFSf0SILqtfTq7q8MfF05ib7aismZbnnV807FNIXK9lt6IIDZHxigjG2WShL4jRlCZq9js3o4E22MFZG000rzCHAWe')
const uuid = require('uuid').v4
const cors = require('cors')
const PdfParse = require('pdf-parse')
const pdfjslib=require('pdfjs-dist/legacy/build/pdf')
const { async } = require('node-stream-zip')
const OpenAI = require('openai')
const {config} = require('dotenv')
const fs = require('fs');



config()

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});



const app=express()
app.use(cors())

app.use(
    bodyparser.urlencoded({
      extended: true,
      limit: '35mb',
      parameterLimit: 50000,
    }),
  );
app.use(bodyparser.json())

app.use(express.json());

app.use(express.raw({ type: "application/pdf", limit: "10mb" }));

const PORT=process.env.PORT || 3001

app.post('/chat',async (req,res)=>{
    const {chatarr}= req.body
    
    const chatCompletion = await openai.chat.completions.create({
      model:"gpt-3.5-turbo",
      messages:chatarr
    })
    res.status(200).json({text:chatCompletion.choices[0].message});
})

app.post('/payment',async (req,res)=>{
    console.log('REQUEST BODY:'+req.body)

    let error,status

    try{
        const {token,product}=req.body

        const customer=await stripe.customers.create({
            email:token.email,
            source:token.id
        })

        const key=uuid()

         const charge =await stripe.charges.create({
            amount:product.price*100,
            currency:'usd',
            customer:customer.id,
            receipt_email:token.email,
            description:`Purchased the ${product.name}`,
            shipping:{
                name:token.card.name,
                address:{
                    line1:token.card.address_line1,
                    line2:token.card.address_line2,
                    city:token.card.address_city,
                    country:token.card.address_country,
                    postal_code:token.card.address_zip 
                }
            }
         },
         {
            idempotencyKey:key
         })

        console.log('CHARGE:' + {charge})
        status='success'
        res.status(200).json({status:status})
    }
    catch(error){
        console.log('ERROR:'+error)
        status='failure'
        res.status(500).json({status:status})
    }

    
})

app.post('/pdfParser', async (req, res) => {
    try {
      const pdfData = req.body;
      const pdfText = await parsePDFText(pdfData)

      const pdfarray=new Uint8Array(pdfData)
    
      const loadingtask=pdfjslib.getDocument(pdfarray)
      loadingtask.promise.then(function(doc){
        const numPages=doc.numPages
        res.status(200).json({text:pdfText,pages:numPages});
      })
      
      
    } catch (error) {
      console.error('Error sending PDF:', error);
      res.status(500).send('Error sending PDF');
    }
});

async function parsePDFText(pdfData) {
    try {
        const pdfText = await PdfParse(pdfData);
        return pdfText.text;
    } catch (error) {
        throw error;
    }
}
  

app.listen(PORT,()=>{
    console.log("App is listening on port 3001")
})
