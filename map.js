
const SettingProxy = (function () {
  'use strict';
  const _domain = Symbol('domain');
  const _proxyConfig = Symbol('proxyConfig');
  const settingHandler = {
    _checkAndGetSettingConfig: function (proxyConfig, name, errorType) {
      if (!proxyConfig.has(name)) {
        throw new errorType(`"${name}" is not configured as a persisted setting.`);
      } else {
        return proxyConfig.get(name);
      }
    },
    get: function (proxyConfig, name) {
      if (name === _proxyConfig) return proxyConfig;

      const config = settingHandler._checkAndGetSettingConfig(proxyConfig, name, ReferenceError);
      if ('value' in config) return config.value;

      let value = localStorage.getItem(config.settingName);

      if (value === null) {
        value = config.default;
      } else {
        try {

          // JSON.parse might raise SyntaxError, bc the setting is malformed
          value = config.type(JSON.parse(value));
        } catch (e) {
          value = config.default;
        }
      }

      value = config.filter(value) ? value : config.default;

      config.value = value;

      return config.value;
    },
    set: function (proxyConfig, name, value) {
      const config = settingHandler._checkAndGetSettingConfig(proxyConfig, name, TypeError);
      if (value === config.default) {
        localStorage.removeItem(config.settingName);
      } else {
        localStorage.setItem(config.settingName, JSON.stringify(value));
      }
      if (!('value' in config) || config.value !== value) {
        const resolved = Promise.resolve();
        config.listeners.forEach(callback => resolved.then(callback));
      }
      config.value = value;
      return true;
    },
  };

  return {
    createSettingProxy: function (domain) {
      return new Proxy(new Map([[_domain, domain]]), settingHandler);
    },
    addSetting: function (settingProxy, name, config = {}) {
      const proxyConfig = settingProxy[_proxyConfig];
      if (proxyConfig.has(name)) {
        throw new TypeError(`A setting was already registered as ${name}.`);
      }
      config = Object.assign(Object.create(null), config);
      delete config.value;
      config.listeners = [];
      if (!('default' in config)) {
        config.default = 'type' in config ? config.type() : false;
      }
      if (!('type' in config)) {
        const defaultType = typeof config.default;
        const basicTypes = { 'boolean': Boolean, 'string': String, 'number': Number };
        config.type = defaultType in basicTypes ? basicTypes[defaultType] : x => x;
      }
      if (!('filter' in config)) {
        config.filter = x => true;
      }
      if (!('settingName' in config)) {
        config.settingName = `${proxyConfig.get(_domain)}.${name}`;
      }
      proxyConfig.set(name, config);
    },
    addListener: function (settingProxy, names, callback) {
      const proxyConfig = settingProxy[_proxyConfig];
      if (!Array.isArray(names)) {
        names = names.split(' ');
      }
      names.forEach(name => {
        settingHandler._checkAndGetSettingConfig(proxyConfig, name, ReferenceError)
          .listeners.push(callback);
      });
      return callback;
    },
  };
})();

// General settings
const Settings = SettingProxy.createSettingProxy('rdo');
Object.entries({
  baseLayer: { default: 'Default' },
  isPopupsHoverEnabled: { default: true },
}).forEach(([name, config]) => SettingProxy.addSetting(Settings, name, config));

const Layers = {
  overlaysLayer: new L.LayerGroup(),
  oms: null,
  debugLayer: new L.LayerGroup(),
};



const MapBase = {
  minZoom: 2,
  maxZoom: 7,
  map: null,
  overlays: [],
  isDarkMode: false,
  markersGroup: null,
  markersTepoGroup: null,
  filtersData: [
    { lat: '-5491.304', lng: '-2939.538', name: 'Tumbleweed Shop', category: 'Gov Shops' },
    { lat: '-5410.399', lng: '-2934.017', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-3661.098', lng: '-2564.532', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-853.099', lng: '-1337.900', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-1837.167', lng: '-438.533', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-217.241', lng: '635.365', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '1332.172', lng: '-1271.772', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '2393.295', lng: '-1416.426', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '2936.933', lng: '1312.263', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-1304.950', lng: '2421.786', name: 'Sale Barn', category: 'Sale Barns' }
  ],
  markerCategories: {
    'Gov Shops': 'Gov Shops',
    'Sale Barns': 'Sale Barns',
  },
  currentFilters: [],
  // Query adjustable parameters
  themeOverride: null,
  viewportX: -70,
  viewportY: 111.75,
  viewportZoom: 3,

  init: function () {
    'use strict';
    const mapBoundary = L.latLngBounds(L.latLng(-144, 0), L.latLng(0, 176));
    const mapLayers = {
      'Default': L.tileLayer('https://s.rsg.sc/sc/images/games/RDR2/map/game/{z}/{x}/{y}.jpg', {
        noWrap: true,
        bounds: mapBoundary,
        attribution: '<a href="https://www.rockstargames.com/" target="_blank">Rockstar Games</a>',
      }),
      'Detailed': L.tileLayer('https://map-tiles.b-cdn.net/assets/rdr3/' + 'webp/detailed/{z}/{x}_{y}.webp', {
        noWrap: true,
        bounds: mapBoundary,
        attribution: '<a href="https://rdr2map.com/" target="_blank">RDR2Map</a>',
      }),
      'Dark': L.tileLayer('https://map-tiles.b-cdn.net/assets/rdr3/' + 'webp/darkmode/{z}/{x}_{y}.webp', {
        noWrap: true,
        bounds: mapBoundary,
        attribution: '<a href="https://github.com/TDLCTV" target="_blank">TDLCTV</a>',
      }),
      'Black': L.tileLayer('https://map-tiles.b-cdn.net/assets/rdr3/' + 'webp/black/{z}/{x}_{y}.webp', {
        noWrap: true,
        bounds: mapBoundary,
        attribution: '<a href="https://github.com/AdamNortonUK" target="_blank">AdamNortonUK</a>',
      }),
    };

    L.Layer.include({
      bindPopup: function (content, options) {
        if (content instanceof L.Popup) {
          L.Util.setOptions(content, options);
          this._popup = content;
          content._source = this;
        } else {
          if (!this._popup || options) {
            this._popup = new L.Popup(options, this);
          }
          this._popup.setContent(content);
        }

        if (!this._popupHandlersAdded) {
          this.on({
            click: this._openPopup,
            keypress: this._onKeyPress,
            remove: this.closePopup,
            move: this._movePopup,
          });
          this._popupHandlersAdded = true;
        }

        this.on('mouseover', function (e) {
          if (!Settings.isPopupsHoverEnabled) return;
          this.openPopup();
        });

        this.on('mouseout', function (e) {
          if (!Settings.isPopupsHoverEnabled) return;

          const that = this;
          const timeout = setTimeout(function () {
            that.closePopup();
          }, 100);

          $('.leaflet-popup').on('mouseover', function (e) {
            clearTimeout(timeout);
            $('.leaflet-popup').off('mouseover');
          });
        });

        return this;
      },
    });

    MapBase.map = L.map('map', {
      preferCanvas: true,
      attributionControl: false,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      zoomControl: false,
      crs: L.CRS.Simple,
      layers: [mapLayers[this.themeOverride || 'Default']],
      zoomSnap: false,
      zoomDelta: (this.maxZoom - this.minZoom) / ((this.maxZoom - this.minZoom) * 2),
      wheelPxPerZoomLevel: 140,
      wheelDebounceTime: 150,
    }).setView([this.viewportX, this.viewportY], this.viewportZoom);


    L.control.layers(mapLayers).addTo(MapBase.map);
    $('.leaflet-control-layers-list span').each(function (index, node) {
      const langKey = node.textContent.trim();
      $(node).html([' ', $('<span>').attr('data-text', langKey).text(langKey)]);
    });

    MapBase.map.on('mousemove', function (e) {
      MapBase.addCoordsOnMap(e);
    });

    MapBase.markersGroup = L.layerGroup();
    MapBase.map.addLayer(MapBase.markersGroup);
    MapBase.markersTepoGroup = L.layerGroup();
    MapBase.map.addLayer(MapBase.markersTepoGroup);

    MapBase.map.on('baselayerchange', function (e) {
      Settings.baseLayer = e.name;
      MapBase.setMapBackground();

      Discoverable.updateLayers();
      Overlay.onSettingsChanged();
      Legendary.onSettingsChanged();
    });

    const southWest = L.latLng(-160, -120),
      northEast = L.latLng(25, 250),
      bounds = L.latLngBounds(southWest, northEast);
    MapBase.map.setMaxBounds(bounds);

    this.initFilterControls();

  },

  initFilterControls: function () {
    const filterContainer = $('.filters');
    Object.keys(this.markerCategories).forEach(category => {
      const checkbox = $(`<label>${category}</label> <div class="input-checkbox-wrapper">
                <input class="input-checkbox" type="checkbox" name="checkbox-${category}" value="${category}" id="checkbox-${category}" checked>
                <label class="input-checkbox-label" for="checkbox-${category}"></label>
              </div> </br>`)
        .appendTo(filterContainer)
        .find(`input`)
        .change(function () {
          const category = $(this).val();
          if (this.checked) {
            MapBase.currentFilters.push(category);
          } else {
            MapBase.currentFilters = MapBase.currentFilters.filter(item => item !== category);
          }
          MapBase.filterMarkers();
        });
    });
    this.currentFilters = Object.keys(this.markerCategories);
    MapBase.filterMarkers();
  },

  gameToMapAndMark: function (lat, lng, name) {
    const lati = (0.01552 * lng + -63.6).toFixed(4);
    const long = (0.01552 * lat + 111.29).toFixed(4);
    MapBase.markMap(lati, long, name);
    return { name, lati, long };
  },

  gameToMapAndMarkTepo: function (lat, lng, name) {
    const lati = (0.01552 * lng + -63.6).toFixed(4);
    const long = (0.01552 * lat + 111.29).toFixed(4);
    MapBase.markMapTepo(lati, long, name);
    return { name, lati, long };
  },

  mapToGame: function (lat, lng, name = 'Debug Marker') {
    const lati = ((parseFloat(lat) + 63.6) / 0.01552).toFixed(4);
    const long = ((parseFloat(lng) - 111.29) / 0.01552).toFixed(4);
    return { name, lati, long };
  },

  setMapBackground: function () {
    'use strict';
    MapBase.isDarkMode = ['Dark', 'Black'].includes(this.themeOverride || Settings.baseLayer) ? true : false;
    $('#map').css('background-color', (() => {
      if (MapBase.isDarkMode)
        return (this.themeOverride || Settings.baseLayer) === 'Black' ? '#000' : '#3d3d3d';
      else
        return '#d2b790';
    }));
  },

  markMap: function (lat, long, name) {
    MapBase.map.addLayer(MapBase.markersGroup);
    
    var icon = L.divIcon({
      className: 'custom-div-icon',
      html: "<div style='background-color:#c30b82;' class='marker-pin'></div><i class='material-icons'>shopping_cart</i>",
      iconSize: [27, 38 ],
      iconAnchor: [15, 42]
  });
    var marker = L.marker([lat, long], {icon: icon}).addTo(MapBase.markersGroup);
    marker.bindPopup(`<b>${name}</b>`);
  },

  markMapTepo: function (lat, long, name) {

    icon = L.divIcon({
      className: 'custom-div-icon',
      html: "<div style='background-color:#ff6b47;' class='marker-pin'></div><i class='material-icons'>search</i>",
      iconSize: [27, 38 ],
      iconAnchor: [15, 42]
  });

    this.map.addLayer(MapBase.markersTepoGroup);
    var marker = L.marker([lat, long], { icon: icon }).addTo(MapBase.markersTepoGroup);
    marker.bindPopup(`<b>${name}</b>`);
  },

  addCoordsOnMap: function (coords) {

    var xy = MapBase.mapToGame(coords.latlng.lat.toFixed(4), coords.latlng.lng.toFixed(4))
    $('.lat-lng-container').css('display', 'block');

    $('.lat-lng-container p').html(`
      Latitude: ${parseFloat(coords.latlng.lat.toFixed(4))}
      <br>Longitude: ${parseFloat(coords.latlng.lng.toFixed(4))}
      <br>X: ${xy.long}
      <br>Y: ${xy.lati}
  `);

    $('#lat-lng-container-close-button').click(function () {
      $('.lat-lng-container').css('display', 'none');
    });
  },

  markerPoints: function (coords1, coords2) {
    var c1 = coords1.replace('vector3(', '').replace(')', '');
    var c1 = c1.split(',');

    MapBase.gameToMapAndMarkTepo(parseFloat(c1[0]), parseFloat(c1[1]));


    var c2 = coords2.replace('vector3(', '').replace(')', '');
    var c2 = c2.split(',');

    MapBase.gameToMapAndMarkTepo(parseFloat(c2[0]), parseFloat(c2[1]));
  },

  filterMarkers: function () {
    this.markersGroup.clearLayers();
    this.filtersData.forEach(marker => {
      if (this.currentFilters.includes(marker.category)) {
        this.gameToMapAndMark(marker.lat, marker.lng, marker.name);
      }
    });
  },

};

MapBase.init();


$('.line').click(function () {
  MapBase.markersTepoGroup.clearLayers();
  var text1 = $('.coords1').val();
  var text2 = $('.coords2').val();
  MapBase.markerPoints(text1, text2);
});

$('.menu-toggle').click(function () {
  if($('.menu-toggle').text() == '>'){
    $(".side-menu").addClass("menu-opened");
    $(".menu-toggle").text("X");
  }else{
    $(".side-menu").removeClass("menu-opened");
    $(".menu-toggle").text(">");
  }


});

// Function to parse CSV and add ranch locations to the map
function parseCSV(csvText) {
  if (!MapBase.map) {
    console.error("MapBase.map is not initialized!");
    return;
  }

  const rows = csvText.split(/\r?\n/).map(row => row.trim()).filter(row => row.length > 0);
  rows.shift(); // Remove header row

  rows.forEach((row, index) => {
    const columns = row.split(",");
    if (columns.length >= 5) {
      const id = columns[0].trim(); // ID column
      const name = columns[3].trim(); // Ranch name
      let coordsText = columns.slice(4).join(",").trim(); // Handle full coordinate field

      try {
        // Fix JSON formatting issues
        coordsText = coordsText.replace(/""/g, '"'); // Fix double double-quotes
        if (coordsText.startsWith('"') && coordsText.endsWith('"')) {
          coordsText = coordsText.slice(1, -1); // Remove outer quotes
        }
        const coords = JSON.parse(coordsText); // Convert to object

        // Ensure coordinates are valid numbers
        if (coords && typeof coords.x === "number" && typeof coords.y === "number") {
          console.log(`Adding marker for: ${name} (ID: ${id}) at [${coords.y}, ${coords.x}]`);

          // Pass both ID and name to the function
          MapBase.gameToMapAndMarkTepo(coords.x, coords.y, `${name} (ID: ${id})`);
        } else {
          console.warn(`Invalid coordinates on line ${index + 2}: ${row}`, coords);
        }
      } catch (error) {
        console.error(`Error parsing coordinates on line ${index + 2}: ${row}`, error);
      }
    } else {
      console.warn(`Skipping invalid row ${index + 2}: ${row}`);
    }
  });
}
