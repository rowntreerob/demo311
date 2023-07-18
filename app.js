/**
 * @author Léo Unbekandt
 * on end support Heroku --> railway hosting
 */
import fetch from 'node-fetch';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { pipeline } from 'node:stream/promises';
import axios from 'axios';
import { URL } from 'url';

import { Upload } from "@aws-sdk/lib-storage";

import  fs from 'fs';
//import { s3Client } from "./libs/s3Client.js";
// Helper function that creates Amazon S3 service client module.
import mime from 'mime';
import { nanoid } from 'nanoid';
import headerParser from 'header-parser';
//import { verifyToken } from './libs/verifyToken.js';
// import { decodeUrl } from './libs/decodeUrl.js';
//import { router } from './authController.js';
import exifr from 'exifr';
import sharp from 'sharp';
import  got  from 'got';
// import { getConf } from "./config.js";
const  MAPKEY = process.env.GOOGLE_MAPS_API_KEY
const  MAPGEOCD = process.env.MAPS_API_GEOCD
const  ROBOFLOWKEY = process.env.ROBOFLOW_KEY

const env = process.env.NODE_ENV || 'development';
const REGION = process.env.AWS_REGION || 'us-west-1';
const bucket = process.env.S3_BUCKET_NAME || 'media-t';
const folder = 'photo';
// vertx ai block
// const filename = "YOUR_PREDICTION_FILE_NAME";
 //const endpointId = "7826424921579323392";
 //const project = '950737254621';
 //const location = 'us-central1';
//const {instance, params, prediction} =
 // aiplatform.protos.google.cloud.aiplatform.v1.schema.predict;
// Imports the Google Cloud Prediction Service Client library
//const {PredictionServiceClient} = aiplatform.v1;
// Specifies the location of the api endpoint
//const clientOptions = {
  //apiEndpoint: 'us-central1-aiplatform.googleapis.com',
//};

// let Config = getConf(env);
// console.log(JSON.stringify(Config.api.parseheaders) + " ENV")
var app = express()
// const hostWithProtocol = req.protocol + '://' + req.get('host')
const __dirname = new URL('.', import.meta.url).pathname;

function wrapAsync (callback) {
  return function (req, res, next) {
    callback(req, res, next)
      .catch(next)
  }
}

//routes w streams MUST be above this !! content type application/octet-stream 
app.use(express.raw({
	inflate: true,
    limit: '9mb',
    type: 'application/octet-stream'}))      
app.use(express.static(__dirname + '/public'));
app.use(cors({ origin: '*' }));



app.post('/rclass/:fname', 
  wrapAsync(async(req, resp, next) => { 
  	const filename = req.params.fname; 
  	let buffCpy1 = Buffer.from(req.body)
  	let base64 = req.body.toString('base64') 	
  	let res = await axios.post(`https://classify.roboflow.com/org311-clip-photos/2?api_key=${ROBOFLOWKEY}`
	,base64 
	, { headers: {
	    'Content-Type': 'application/x-www-form-urlencoded'
	  }
	}) 
  	resp.set({'Content-Type': 'application/json'});
  	resp.end( 
		JSON.stringify({
  	
  			data: res.data.predictions			
		}) 
	);		
  }
 )
)

app.get('/addr/:latitude/:longitude', 
  wrapAsync(async(req, resp, next) => { 
  	const latitude = req.params.latitude; 
  	const longitude = req.params.longitude;
  	const rsult = await got.get(
  		`${MAPGEOCD}?latlng=${latitude},${longitude}&key=${MAPKEY}`
  		).json();
  	const mapAddr = rsult.results[0].formatted_address;  // parse street.addr 
  	resp.set({'Content-Type': 'application/json'});
  	resp.end( 
		JSON.stringify({	
  			data: mapAddr			
		}) 
	);	
  }))

app.use(headerParser);

// app.use(express.json({type:'application/json' }))     
// app.use(express.json({limit: '1mb'}))
app.use(express.urlencoded({ limit: '3mb', extended: true }))


app.get('/', function (req, res) {
  res.send(' railway app here API is hosted')
})
app.get('/health', (req, res) => {
  res.send('Hello World! a railway app here')
})



var server = app.listen(process.env.PORT || 3000, function () {
  var host = server.address().address
  var port = server.address().port
  console.log('App listening at http://%s:%s', host, port)
})
