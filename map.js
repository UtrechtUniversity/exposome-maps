var map = L.map('map',{zoomControl:false,minZoom:6}).setView([47.58, 6.06], 6);
window.currentDisplayedLayer = null;
map.createPane('basemaps');


var geoserverURL = "https://exposome.uu.nl/geoserver/wms";
// var geoserverURL = "http://localhost:8080/geoserver/EXPANSE_map/wms"; // Used for testing


var geoserver_workspace = "EXPANSE_map";

var slider = document.getElementById("opacity-slider");
var opacityValue = parseFloat(slider.value);

// Basemap options
var osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a>OpenStreetMap</a> contributors',
    isBasemap: true,
    pane: 'basemaps'
});
var darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a>OpenStreetMap</a> contributors &copy; <a>CARTO</a>',
    isBasemap: true,
    pane: 'basemaps'
});
var lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a>OpenStreetMap</a> contributors &copy; <a>CARTO</a>',
    isBasemap: true,
    pane: 'basemaps'
});

// Add baselayers to selection control
map.getPane('basemaps').style.zIndex = 200;
map.getPane('basemaps').style.pointerEvents = 'none';

var baseLayers = {
    "Light background": lightLayer,
    "Dark background": darkLayer,
    "OpenStreetMap": osmLayer
};
L.control.layers(baseLayers, {}, {collapsed: false}).addTo(map);

// Keep basemaps always at the back
map.on('baselayerchange', function(e) {
    if (e.layer.options && e.layer.options.isBasemap) {
        e.layer.getPane().style.zIndex = 100;
    }
});

// Default basemap
lightLayer.addTo(map);
lightLayer.bringToBack();

// Prepare dates to be used as parameters for WMS requests
function selectDateCleanup(dateStr) {
    console.log("Selected date string:", dateStr);
    var length = String(dateStr).length;
    var monthMap = {
    "Jan": "01",
    "January": "01",
    "Feb": "02",
    "February": "02",
    "Mar": "03",
    "March": "03",
    "Apr": "04",
    "April": "04",
    "May": "05",
    "Jun": "06",
    "June": "06",
    "Jul": "07",
    "July": "07",
    "Aug": "08",
    "August": "08",
    "Sep": "09",
    "September": "09",
    "Oct": "10",
    "October": "10",
    "Nov": "11",
    "November": "11",
    "Dec": "12",
    "December": "12"
    };
    if (length === 4) { // Yearly, add day and month
        return dateStr
    }
    // Daily, also check that there are no letters in the string to avoid confusion with monthly format
    else if (length === 10 && !/[a-zA-Z]/.test(dateStr)) { 
        var parts = dateStr.split("-");
        if (parts.length === 3) {
            var day = parts[0].padStart(2, '0');
            var month = parts[1].padStart(2, '0');
            var year = parts[2];
            return `${year}-${month}-${day}`;
        } else {
            console.warn("Unexpected date format:", dateStr);
            return dateStr; // Return as is if format is unexpected
        }
    }
    else {
        var year  = dateStr.substring(dateStr.length - 4);
        var month = monthMap[dateStr.substring(0, dateStr.length - 5)];
        return year + "-" + month
    }
}

// Add event listener for the show on map button. When clicked, it will fetch the selected layer
document.getElementById("showOnMapBtn").addEventListener("click", function() {
    if (window.selectedItem) {        
        var layerName = window.selectedItem.geoserver_layer;
        console.log("Layer name:", layerName);
        var dateParameter = selectDateCleanup(window.selectedDate);
        console.log("Selected date:", window.selectedDate);
        console.log("Date parameter for WMS request:", dateParameter);
        var style = window.selectedItem.geoserver_style

        if (window.currentDisplayedLayer) {
            map.removeLayer(window.currentDisplayedLayer);
        }
        const retryTileLayer = L.TileLayer.WMS.extend({
            createTile: function (coords, done) {
                const tile = document.createElement('img');

                const url = this.getTileUrl(coords);
                let attempts = 0;
                const maxRetries = 10;

                const loadTile = () => {
                    attempts++;
                    tile.src = url;
                };

                tile.onload = function () {
                    done(null, tile);
                };

                tile.onerror = function () {
                    if (attempts < maxRetries) {
                        setTimeout(loadTile, 500 * attempts);
                    } else {
                        done(new Error('Tile failed after retries'), tile);
                    }
                };

                loadTile();
                return tile;
            }
        });

        window.currentDisplayedLayer = new retryTileLayer(geoserverURL, {
            layers: `${geoserver_workspace}:${layerName}`,
            time: dateParameter,
            format: 'image/png8',
            version: '1.1.0',
            styles: '',
            transparent: true,
            pane: 'overlayPane',
            tileSize: 128,
            keepBuffer:3,
            updateWhenIdle: true, 
            updateWhenZooming: false, 
        }).addTo(map);

        // Update map label
        var mapLabel = document.getElementById("map-label");
        mapLabel.innerHTML = `<strong> ${window.selectedItem.Title} ${window.selectedDate}</strong>`;

        // Get legend
        if (map._legends) {
            Object.values(map._legends).forEach(l => map.removeControl(l));
            map._legends = {};
        }
        var legendUrl = geoserverURL + `?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&style=EXPANSE_map:${style}_legend&STRICT=false`;
        var legend = L.control({position: 'bottomleft'});
        legend.onAdd = function () {
            var div = L.DomUtil.create('div', 'info legend-' + style);
            div.innerHTML += '<img src="' + legendUrl + '" alt="Legend"/>';
            return div;
        };
        legend.addTo(map);
        legend._legendName = style;
        map._legends = map._legends || {};
        map._legends[style] = legend;

        // Move legend 30 pix up to avoid overlapping with opacity slider
        var legendDiv = document.querySelector('.legend-' + style);
        if (legendDiv) {
            legendDiv.style.marginBottom = '10px';
        }

        // Switch basemap to window.selectedItem.default_basemap if this value is not empty. Such as the darkLayer for LAN layers
        var defaultBasemap = window.selectedItem.default_basemap;
        if (defaultBasemap) {
            var basemapLayer = baseLayers[defaultBasemap.charAt(0).toUpperCase() + defaultBasemap.slice(1) + " background"];
            if (basemapLayer) {
                basemapLayer.addTo(map);
                basemapLayer.bringToBack();
            }
        }
        


    }
});

map.on('click', function(e) {
    if (!window.selectedItem) {
        console.warn("No layer selected");
        return;
    }
    var layerName = window.currentDisplayedLayer.options.layers;
    console.log("Layer name:", layerName);

    var bbox = map.getBounds().toBBoxString();
    var point = map.latLngToContainerPoint(e.latlng);
    var x = Math.round(point.x);
    var y = Math.round(point.y);

    var requestURL = `${geoserverURL}?request=GetFeatureInfo&service=WMS&version=1.1.0&layers=${layerName}&query_layers=${layerName}&info_format=application/json&x=${x}&y=${y}&width=${map.getSize().x}&height=${map.getSize().y}&bbox=${bbox}&srs=EPSG%3A4326`;
    fetch(requestURL).then(response => {
        if (!response.ok) {
            throw new Error('No network response');
        }
        return response.json();
    }).then(data => {
                    if (!data || !data.features || data.features.length === 0 || data.features[0].properties.GRAY_INDEX == -9999 || data.features[0].properties.GRAY_INDEX == 65535 || data.features[0].properties.GRAY_INDEX == window.selectedItem.no_data_value) return;
                    if (Math.abs(data.features[0].properties.GRAY_INDEX + 3.3999999521443642e+38) < 1e+30 || Math.abs(data.features[0].properties.GRAY_INDEX + 3.4028234663852886e+38) < 1e+30) return;
                    var popupContent = '';
                    var grayIndex = null;
                    console.log(data);
                    
                    grayIndex = data.features[0].properties.GRAY_INDEX
                    if (!grayIndex) return;
                    console.log(grayIndex)
                    popupContent = `${Math.round(grayIndex * 10) / 10}`;

                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent(popupContent)
                        .openOn(map);
                }).catch(error => {
                    console.error('Couldnt fetch value:', error);
                });

    console.log("GetFeatureInfo URL: ", requestURL);
});

// Opacity slider control

slider.addEventListener("input", function() {
    opacityValue = parseFloat(slider.value);
    if (window.currentDisplayedLayer) {
        window.currentDisplayedLayer.setOpacity(opacityValue);
    }
});


//     if (activeLayer.size > 0) {
//         var point = map.latLngToContainerPoint(e.latlng);


//         //request data for active layer(skip basemaps)
//         activeLayers.forEach(function(layer) {
//             if (layer.options.isBasemap) {
//                 return;
//             }

//             var layerName = layer.options.layers;
//             var bbox = map.getBounds().toBBoxString();

//             var requestUrl = `${geoServerUrl}?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=${layerName}&query_layers=${layerName}&INFO_FORMAT=application/json&x=${x}&y=${y}&SRS=EPSG:4326&WIDTH=${map.getSize().x}&HEIGHT=${map.getSize().y}&bbox=${bbox}&_=${Date.now()}`;

//             fetch(requestUrl)
//                 .then(response => {
//                     if (!response.ok) {
//                         throw new Error('No network response');
//                     }
//                     return response.json();
//                 })
//                 .catch(error => {
//                     // console.error('Fetch error:', error);
//                 });
//         });
//     }
// });
