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


import {db, ObjectId } from "./db/conn.mjs";

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


// TODO new route ./getNear/lat/long/:radius/type   get id get type use radius -> issuesList json-string 
//      Add type to projection unless "ALL"

app.get('/near/:id/:radius', 
  wrapAsync(async(req, resp, next) => {
  	let _id = req.params.id
  	let _radius = Number(req.params.radius)
  	const objectId = new ObjectId(_id);
	let issue = await db.collection("issues").findOne({ "_id": objectId });
	if (!issue) {
      throw new Error('ERR DNF the id in the DB')
    }
	const latLng = issue.location.coordinates;
	const result = await db.collection("issues").find({
		"location": {
		    "$near": {
		        "$geometry": {
		            "type": "Point",
		            "coordinates": latLng
		        },
		        "$maxDistance": _radius
		    }
		}, 'predictions.0.class': { $eq: 'encampment' }
	}).project(
    	{"_id": 0, "location.coordinates": 1, "address": 1, "predictions[0]class": 1, "url": 1
	}).toArray()
	if (!result) {
      throw new Error('ERR DNF DB issue nearby')
    }
    //cursor to array is native array, so add 'data' as field to hold arrays value
    let obj = { data: result }
  	resp.set('content-type', 'application/json');
  	resp.json(obj);

  })
)
//TODO  { type: { $first: "$predictions" } }
app.get('/geofnd/:lat/:long/:radius/:type', 
  wrapAsync(async(req, resp, next) => { 
    let _lat = Number(req.params.lat)
    let _long = Number(req.params.long)
    let coordinates = [_long,_lat]
  	let _radius = Number(req.params.radius)
  	let _type = req.params.type
	const result = await db.collection("issues").find({
	"location": {
	    "$near": {
	        "$geometry": {
	            "type": "Point",
	            "coordinates": coordinates
	        },
	        "$maxDistance": _radius
	    }
	}, 'predictions.0.class': { $eq: _type }
	}).project(
    	{"_id": 0, "location.coordinates": 1, "address": 1, "predictions": { $slice: 1 },"url": 1
	}).toArray()
	if (!result) {
      throw new Error('ERR DNF DB issue nearby')
    }
    //cursor to array is native array, so add 'data' as field to hold arrays value
    let obj = { data: result }
  	resp.set('content-type', 'application/json');
  	resp.json(obj);
  })
 ) 

/* insert to DB based on JSON returned by previous call on ./rclass
* all image interpreted data to db layer 
* {"coordinates":"address":"predictions":"url" "time"}
*/
app.post('/insertr', 
  wrapAsync(async(req, resp, next) => { 
	
	let coordinates = req.body.coordinates
	let address = req.body.address.replace(', USA', '')
	let predictions = req.body.predictions
	let s3url = req.body.url
	let d = new Date().toISOString()
	let issue = {"location": {
		  "type": "Point",
		  "coordinates": coordinates
	  }, "address": address,
	  "predictions":predictions,
	  "url": s3url,
	  "last_modified": d
	  }
	let c = await db.collection("issues");
    issue._id = (await c.insertOne(issue)).insertedId
  	resp.json(issue).status(204);	
  }
 )
)


/* handle a photo uploaded on http post
* middleware has put binary file bytes -> req.body
* make series of calls on the photo in r.body( gps, maps str addr, 
* - parse EXIF data from the image
* - build street address from result of EXIF call
* - store photo on S3 AWS
* - roboflow classify by img type : graffiti, garbage, encampments
* make response to return to client so client can review and then 
*    submit to DB via "done" button on UI
*/
app.post('/rclass/:fname', 
  wrapAsync(async(req, resp, next) => {
  // TODO splt filename on dot take 2nd word, appnd to nanoid as name 
  console.log('fnm ', req.params.fname, ' ', req.body.length) 
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
	// ensure size LT 3G && that photo embeds valid EXIF / GPS 		
  	if(req.body.length > 2950000) {
  		//let myImg = await resize(req.body)
  		let data = await sharp( req.body ).resize(800).jpeg({ mozjpeg: true }).toBuffer()
  		res = await getClass(data.toString('base64'))
  	} else{  	
		res = await getClass(req.body.toString('base64'))
	}
	//get gps from the photo w gps ( lat, long ) get street addr from geocoder api
	gps = await exifr.gps(buffCpy1);	 
	if(typeof gps === "undefined") {
		console.log(gps)
		mapAddr = 'GPS not found in image'
		gps = {latitude: 0.0, longitude: 0.0}
		s3data = {Location: 'no upload was done'}
	} else if(isNaN(gps.latitude)){
		s3data = {Location: 'no upload was done'}
		mapAddr = 'GPS not a number'
		console.log(gps)
		gps = {latitude: 0.0, longitude: 0.0}
	}
	else {
		console.log(gps)
		rsult = await got.get(
  			`${MAPGEOCD}?latlng=${gps.latitude},${gps.longitude}&key=${MAPKEY}`
  		).json();
  		mapAddr = (rsult.results[0].formatted_address);
  		// POST image to S3 store on AWS
    	console.log("Upload file to:",`s3://${params.Bucket}/${params.Key}`);
    	const s3Upload = new Upload({ client: s3Client, params: params });
    	s3data = await s3Upload.done();
	}

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
  	let res;   	
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
  	let dbstring = `${MAPGEOCD}?latlng=${latitude},${longitude}&key=${MAPKEY}`
  	const rsult = await got.get(dbstring).json();
  	let mapAddr = 'no results from geocode API'
  	if(rsult.results[0].formatted_address){	
  		mapAddr = rsult.results[0].formatted_address;
  	}  else { console.log(dbstring)}
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
