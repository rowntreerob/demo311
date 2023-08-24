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
import sharp from 'sharp';
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client} from "@aws-sdk/client-s3";
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


import db from "./db/conn.mjs";

import  got  from 'got';
// import { getConf } from "./config.js";
const  MAPKEY = process.env.GOOGLE_MAPS_API_KEY
const  MAPGEOCD = process.env.MAPS_API_GEOCD
const  ROBOFLOWKEY = process.env.ROBOFLOW_KEY
const env = process.env.NODE_ENV || 'development';
const REGION = process.env.AWS_REGION || 'us-west-1';
const bucket = process.env.S3_BUCKET_NAME || 'media-t';
const s3Client = new S3Client({ region: REGION });

var app = express()
// const hostWithProtocol = req.protocol + '://' + req.get('host')
const __dirname = new URL('.', import.meta.url).pathname;

function wrapAsync (callback) {
  return function (req, res, next) {
    callback(req, res, next)
      .catch(next)
  }
}
// TODO config domain 
async function getClass(base64) {
	let res = await axios.post(`https://classify.roboflow.com/org311-clip-photos/2?api_key=${ROBOFLOWKEY}`
		,base64 
		, { headers: {'Content-Type': 'application/x-www-form-urlencoded'}
	})
	return res
}

//routes w streams MUST be above this !! content type application/octet-stream 
app.use(express.raw({
	inflate: true,
    limit: '9mb',
    type: 'application/octet-stream'}))      
app.use(express.static(__dirname + '/public'));
app.use(cors({ origin: '*' }));
app.use(express.json({type:'application/json' })) 

/* insert to DB based on JSON returned by previous call on ./rclass
* all image interpreted data to db layer 
* {"coordinates":"address":"predictions":"url" "time"}
*/
app.post('/insertr', 
  wrapAsync(async(req, resp, next) => { 
	
	let coordinates = req.body.coordinates //[-122.41467, 37.75904]
	let address = req.body.address //"2345 24th st. san franciso"
	let predictions = req.body.predictions // [{'class': 'encampment', 'confidence': 0.456}, {'class': 'graffiti', 'confidence': 0.1869}]
	let s3url = req.body.url // "https://media-t.s3.amazonaws.com/PXL_20230716_173824606.jpg"
	let d = new Date().toISOString()
	let issue = {"location": {
		  "type": "Point",
		  "coordinates": coordinates
	  }, "address": address,
	  "predictions":predictions,
	  "url": s3url,
	  "last_modified": d
	  }
	let collection = await db.collection("issues");
	let result = await collection.insertOne(issue);
  	resp.send(result).status(204);	
  }
 )
)


/* handle a photo uploaded on http post
* middleware has put binary file bytes -> req.body
* make series of calls on the photo ( gps, maps str addr, 
* - roboflow classify by img type : graffiti, garbage, encampments
* - parse EXIF data from the image
* - build street address from result of EXIF call
* - store photo on S3 AWS
* make response to return to client so client can review and then 
*    submit to DB via "done" button on UI
*/
app.post('/rclass/:fname', 
  wrapAsync(async(req, resp, next) => {
  // TODO splt filename on dot take 2nd word, appnd to nanoid as name  
  	const filename =  nanoid() + '.' + req.params.fname.split('.').pop(); 
  	let buffCpy1 = req.body	
  	let res, base64, rsult, mapAddr, gps, s3data
  	let type = mime.getType(filename);
    let _path = 'photo' + '/' +filename; 
  	let options = {
		ifd0: false,
		exif: false,
		gps: ['GPSLatitudeRef', 'GPSLatitude', 'GPSLongitudeRef', 'GPSLongitude'],
		interop: false,
		ifd1: false // thumbnail
	} 
	const params = {
      Bucket:  "media-t",
      Key: _path,
      ContentType: type,
      Body: buffCpy1,
      Metadata: { filename: filename, path: _path },
      ACL: 'public-read'
    };
	// call roboflow to classify image 		
  	if(req.body.length > 2950000) {
  		//let myImg = await resize(req.body)
  		let data = await sharp( req.body ).resize(800).jpeg({ mozjpeg: true }).toBuffer()
  		res = await getClass(data.toString('base64'))
  	} else{  	
		res = await getClass(req.body.toString('base64'))
	}
	//get gps from the photo w gps ( lat, long ) get street addr from geocoder api
	gps = await exifr.parse(buffCpy1, options);  // api -> get EXIF latlng from buffer(photo)
	if(typeof gps === "undefined") {
		mapAddr = 'GPS not found in image'
		gps = {latitude: 0.0, longitude: 0.0}
	}
	else {
		rsult = await got.get(
  			`${MAPGEOCD}?latlng=${gps.latitude},${gps.longitude}&key=${MAPKEY}`
  		).json();
  		mapAddr = rsult.results[0].formatted_address;  // parse street.addr 	
	}
    // POST image to S3 store on AWS
    console.log("Upload file to:",
        `s3://${params.Bucket}/${params.Key}`);      
    const s3Upload = new Upload({ client: s3Client, params: params });
    s3data = await s3Upload.done();
    // build response from various calls made above
    let coordinates = [gps.longitude, gps.latitude]	
	let predictions = [res.data.predictions[0], res.data.predictions[1]]
  	resp.set({'Content-Type': 'application/json'});
  	resp.end( 
		JSON.stringify({
  			coordinates: coordinates
   			, address: mapAddr
  			, predictions: predictions 			
  			, url: s3data.Location			
		}) 
	);		
  }
 )
)

app.post('/imclass/:fname',
  wrapAsync(async(req, resp, next) => {
  	const filename = req.params.fname;   	
  	let base64 = req.body.toString('base64')  	
  	// call roboflow to classify image 		
  	if(req.body.length > 2950000) {
  		let data = await sharp( req.body ).resize(800).jpeg({ mozjpeg: true }).toBuffer()
  		res = await getClass(data.toString('base64'))
  	} else{  	
		res = await getClass(req.body.toString('base64'))
	} 
  	resp.set({'Content-Type': 'application/json'});
  	resp.end( 
		JSON.stringify({  	
  			data: res.data.predictions			
		}) 
	);	
	})
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
