  	// get parms lat, long from page addr and do a fetch onload
  	// fetch('link').then(response => {}).catch(error => {}) <- data: [result]
  	//   response contains all matching issues within n meters of the last issues' position
let map, bounds, infoWindow;
let icnlst = { encampment: './encamp.png', graffiti: './graffiti_2.jpg', garbage: './garbage.png' }
var qry = {};
location.search.substr(1).split("&").forEach(function(item) {qry[item.split("=")[0]] = item.split("=")[1]})
console.log(qry)
let  markers = []
     //   ['Brooklyn Museum, NY', 40.671349546127146, -73.96375730105808],
let infoWindowContent = []
// const domain = 'localhost:3000'
 const domain = 'demo311-production.up.railway.app'
var url = `https://${domain}/geofnd/${qry.lat}/${qry.long}/400/${qry.type}`
console.log(url)
const response = await fetch(url);
const text = await response.text()
document.getElementById("box").value = text

document.getElementById("mapit").onclick = async function () { 
  parse();
  await initMap();  
  await markersMap();
};

document.getElementById("back").onclick = async function () { 
  window.location.href = './index.html'
};

function getIcon(key){
	return icnlst[key]
}

async function initMap() {
  const { Map, InfoWindow } = await google.maps.importLibrary("maps");
 
  var mapOptions = {
	center: { lat: Number(qry.lat), lng: Number(qry.long) },
    mapTypeId: 'roadmap'
    };
  map = new Map(document.getElementById("map"), mapOptions);
  bounds = new google.maps.LatLngBounds();
  infoWindow = new InfoWindow();
}

  /*
 * based on response from call to DB in the topmost fetch()
 * fill out Markers for each issue returned by query 
 * bind the infowindow that parse() filled in to a specific marker 
 * add the marker to the map
 */     
 async function markersMap() {
  const { Marker } = await google.maps.importLibrary("marker")
  const { LatLng } = await google.maps.importLibrary("core")
     // Add multiple markers to map
    let marker, i; 
     // Place each marker on the map  
    for( i = 0; i < markers.length; i++ ) {
        var position = new LatLng(markers[i][1], markers[i][2]);
        bounds.extend(position);
        marker = new Marker({
            position: position,
            map: map,
            title: markers[i][0]
        });
        
        // Add info window to marker    
        google.maps.event.addListener(marker, 'click', (function(marker, i) {
            return function() {
                infoWindow.setContent(infoWindowContent[i][0]);
                infoWindow.open(map, marker);
            }
        })(marker, i));

        // Center the map to fit all markers on the screen
        map.fitBounds(bounds);
    }
 }
 
 function template(strings, ...keys) {
  return (...values) => {
    const dict = values[values.length - 1] || {};
    const result = [strings[0]];
    keys.forEach((key, i) => {
      const value = Number.isInteger(key) ? values[key] : dict[key];
      result.push(value, strings[i + 1]);
    });
    return result.join("");
  };
}
   
  /*
 * based on response from call to DB in the topmost fetch()
 * construct infowindow arrays with block latLong postions AND of html to appear
 * onClick of the corresponding marker placed by markersMap()
 */   
//  ['graffiti 2889 24th st', 37.752580555555554, -122.40998611111112, 4],
	function parse() {

	  let text = document.getElementById("box").value;
	  let obj = JSON.parse(text);
	  let mm , ii, p0,p1,p2, kk

	  obj.data.forEach(function(elem, idx, array){
	  	mm = ['encampment', elem.location.coordinates[1], elem.location.coordinates[0]]
	  	markers.push(mm)

	  	const t1Closure = template`<div class="info_content">
	  	<h4>${"p0"}</h4><div class="ico_wrap"><a href="${"p1"}">
	  	<img src="${"p2"}"></a></div></div>`;
	  	p0 = elem.address;	  	
	  	p1 = elem.url;
		kk = `${elem.predictions[0].class}`
		p2 = getIcon(kk)  

	  	ii = [t1Closure({ p0: p0, p1: p1, p2: p2 })]
	  	infoWindowContent.push(ii)
		});	
	}
