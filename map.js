
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
    { lat: '-5491.304', lng: '-2939.538', name: 'Tumbleweed General Store', category: 'Gov Shops' },
    { lat: '-5410.399', lng: '-2934.017', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-3661.098', lng: '-2564.532', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-853.099', lng: '-1337.900', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-1837.167', lng: '-438.533', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-217.241', lng: '635.365', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '1332.172', lng: '-1271.772', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '2393.295', lng: '-1416.426', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '2936.933', lng: '1312.263', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-1304.950', lng: '2421.786', name: 'Sale Barn', category: 'Sale Barns' },
    { lat: '-6015.393', lng: '-3244.911', name: 'Tumbleweed Mines', category: 'Mines' },
    { lat: '-5505.753', lng: '-2967.676', name: 'Tumbleweed Gunsmith', category: 'Gunsmith' },
    { lat: '-5519.563', lng: '-2906.338', name: 'Tumbleweed Saloon', category: 'Saloon' },
    { lat: '-5228.920', lng: '-2132.485', name: 'Rathskeller Farm', category: 'Farm' },
    { lat: '-5199.711', lng: '-2150.062', name: 'Rathskeller Stable', category: 'Stable' },
    { lat: '-5187.663', lng: '-2152.613', name: 'Rathskeller Blacksmith', category: 'Blacksmith' },
    { lat: '-3356.971', lng: '-3431.317', name: 'Wayani Tribe', category: 'Tribe' },
    { lat: '-3697.155', lng: '-2663.599', name: 'Armadillo Lumberjack', category: 'Lumberjack' },
    { lat: '-3699.216', lng: '-2633.480', name: 'Armadillo Brewery', category: 'Brewery' },
    { lat: '-3739.629', lng: '-2549.043', name: 'Armadillo Bakery', category: 'Bakery' },
    { lat: '-3698.686', lng: '-2599.886', name: 'Armadillo Saloon', category: 'Saloon' },
    { lat: '-3675.894', lng: '-2593.150', name: 'Armadillo Gunsmith', category: 'Gunsmith' },
    { lat: '-3661.542', lng: '-2594.682', name: 'Armadillo Pharmacy', category: 'Pharmacy' },
    { lat: '-3654.336', lng: '-2594.680', name: 'Armadillo Undertaker', category: 'Undertaker' },
    { lat: '-3631.846', lng: '-2544.682', name: 'Armadillo Stable', category: 'Stable' },
    { lat: '-3646.715', lng: '-2625.142', name: 'Armadillo Blacksmith', category: 'Blacksmith' },
    { lat: '-3656.067', lng: '-2629.979', name: 'Armadillo Tailor', category: 'Tailor' },
    { lat: '-3687.867', lng: '-2624.985', name: 'Armadillo General Store', category: 'General Store' },
    { lat: '-3613.173', lng: '-2610.454', name: 'Armadillo Small Saloon', category: 'Saloon' },
    { lat: '-2395.647', lng: '-2383.820', name: 'McGavin Blacksmith', category: 'Blacksmith' },
    { lat: '-1391.067', lng: '-2320.182', name: 'Thieves Landing Saloon', category: 'Saloon' },
    { lat: '3023.001', lng: '560.9584', name: 'Van Horn Imports', category: 'Brewery' },
    { lat: '-878.838', lng: '-1370.658', name: 'Blackwater Stable', category: 'Stable' },
    { lat: '-866.894', lng: '-1292.006', name: 'Blackwater Lumberjack', category: 'Lumberjack' },
    { lat: '-972.369', lng: '-1198.133', name: 'Blackwater Church', category: 'Church' },
    { lat: '-819.373', lng: '-1319.424', name: 'Blackwater Saloon', category: 'Saloon' },
    { lat: '-777.860', lng: '-1323.971', name: 'Blackwater General Store', category: 'General Store' },
    { lat: '-764.885', lng: '-1325.147', name: 'Blackwater Gunsmith', category: 'Gunsmith' },
    { lat: '-780.944', lng: '-1296.550', name: 'Blackwater Tailor', category: 'Tailor' },
    { lat: '-765.205', lng: '-1275.921', name: 'Blackwater Blacksmith', category: 'Blacksmith' },
    { lat: '-782.859', lng: '-1304.021', name: 'Blackwater Pharmacy', category: 'Pharmacy' },
    { lat: '-1832.216', lng: '-594.403', name: 'Strawberry Blacksmith', category: 'Blacksmith' },
    { lat: '-1827.041', lng: '-556.117', name: 'Strawberry Stable', category: 'Stable' },
    { lat: '-1822.370', lng: '-433.394', name: 'Strawberry Lumberjack', category: 'Lumberjack' },
    { lat: '-1843.847', lng: '-421.249', name: 'Strawberry Gunsmith', category: 'Gunsmith' },
    { lat: '-1819.708', lng: '-372.478', name: 'Strawberry Saloon', category: 'Saloon' },
    { lat: '-1789.796', lng: '-388.278', name: 'Strawberry General Store', category: 'General Store' },
    { lat: '-2603.545', lng: '-51.479', name: 'MKwa-Ki Tribe', category: 'Tribe' },
    { lat: '-2593.616', lng: '414.199', name: 'Big Valley Blacksmith', category: 'Blacksmith' },
    { lat: '-2558.314', lng: '396.244', name: 'Big Valley Stable', category: 'Stable' },
    { lat: '-2508.314', lng: '443.244', name: 'Big Valley Farm', category: 'Farm' },
    { lat: '-1893.215', lng: '1330.599', name: 'Omen Bounty Guild', category: 'Bounty Guild' },
    { lat: '-1845.122', lng: '420.239', name: 'Black Hawk Tribe', category: 'Tribe' },
    { lat: '-2057.279', lng: '-1911.772', name: 'The Collectors Bounty Guild', category: 'Bounty Guild' },
    { lat: '-5177.095', lng: '-2106.962', name: 'The Highland Bounty Guild', category: 'Bounty Guild' },
    { lat: '-414.276', lng: '-143.958', name: 'Limpany Undertaker', category: 'Undertaker' },
    { lat: '-383.776', lng: '-95.958', name: 'Limpany Lumberjack', category: 'Lumberjack' },
    { lat: '-361.596', lng: '-110.392', name: 'Limpany Saloon', category: 'Saloon' },
    { lat: '-391.726', lng: '-135.617', name: 'Limpany Tailor', category: 'Tailor' },
    { lat: '-249.369', lng: '686.301', name: 'Valentine Lumberjack', category: 'Lumberjack' },
    { lat: '-363.509', lng: '791.437', name: 'Valentine Stable', category: 'Stable' },
    { lat: '-325.473', lng: '803.936', name: 'Valentine General Store', category: 'General Store' },
    { lat: '-314.482', lng: '808.526', name: 'Large Valentine Saloon', category: 'Saloon' },
    { lat: '-282.193', lng: '778.471', name: 'Valentine Gunsmith', category: 'Gunsmith' },
    { lat: '-221.715', lng: '812.620', name: 'Valentine Church', category: 'Church' },
    { lat: '-774.929', lng: '-1349.9797', name: 'Small Valentine Saloon', category: 'Brewery' },
    { lat: '-22.840', lng: '1226.070', name: 'Cumberland Bounty Guild', category: 'Bounty Guild' },
    { lat: '441.932', lng: '1619.116', name: 'Choctaw Tribe', category: 'Tribe' },
    { lat: '442.652', lng: '2243.470', name: 'Wapiti Tribe', category: 'Tribe' },
    { lat: '876.724', lng: '309.623', name: 'Black Crow Tribe', category: 'Tribe' },
    { lat: '1398.196', lng: '277.824', name: 'Emerald Farm', category: 'Farm' },
    { lat: '1439.196', lng: '268.324', name: 'Emerald Blacksmith', category: 'Blacksmith' },
    { lat: '729.820', lng: '-468.262', name: 'Lemoyne Mines', category: 'Mines' },
    { lat: '1053.192', lng: '-1122.161', name: 'Rhodes Farm', category: 'Farm' },
    { lat: '1289.192', lng: '-1216.161', name: 'Rhodes Church', category: 'Church' },
    { lat: '1322.898', lng: '-1291.387', name: 'Rhodes General Store', category: 'General Store' },
    { lat: '1310.398', lng: '-1309.887', name: 'Rhodes Undertaker', category: 'Undertaker' },
    { lat: '1323.906', lng: '-1320.276', name: 'Rhodes Gunsmith', category: 'Gunsmith' },
    { lat: '1313.406', lng: '-1351.776', name: 'Rhodes Blacksmith', category: 'Blacksmith' },
    { lat: '1336.987', lng: '-1372.041', name: 'Rhodes Saloon', category: 'Saloon' },
    { lat: '1463.433', lng: '-1370.959', name: 'Rhodes Lumberjack', category: 'Lumberjack' },
    { lat: '1429.933', lng: '-1287.459', name: 'Rhodes Stable', category: 'Stable' },
    { lat: '1867.837', lng: '-1350.439', name: 'Caliga Stable', category: 'Stable' },
    { lat: '1783.689', lng: '-818.857', name: 'The Grim Fellows Bounty Guild', category: 'Bounty Guild' },
    { lat: '2508.794', lng: '-1462.809', name: 'Saint Denis Stable', category: 'Stable' },
    { lat: '2661.061', lng: '-1390.178', name: 'Saint Denis Tailor', category: 'Tailor' },
    { lat: '2600.062', lng: '-1357.179', name: 'Saint Denis Newspaper', category: 'Unique' },
    { lat: '2640.422', lng: '-1222.968', name: 'Bastile Saloon', category: 'Saloon' },
    { lat: '2654.925', lng: '-1172.155', name: 'Saint Denis Brewery', category: 'Brewery' },
    { lat: '2762.544', lng: '-1129.082', name: 'Saint Denis Undertaker', category: 'Undertaker' },
    { lat: '2859.576', lng: '-1200.520', name: 'The Fence', category: 'Unique' },
    { lat: '2878.575', lng: '-1263.020', name: 'Saint Denis Lumberjack', category: 'Lumberjack' },
    { lat: '2864.922', lng: '-1398.571', name: 'The Grand Korrigan', category: 'Unique' },
    { lat: '2582.877', lng: '-1009.323', name: 'Devils Elixirs Pharmacy', category: 'Pharmacy' },
    { lat: '2612.377', lng: '-935.823', name: 'Saint Denis Blacksmith', category: 'Blacksmith' },
    { lat: '2950.533', lng: '529.1925', name: 'Van Horn Saloon', category: 'Saloon' },
    { lat: '2967.533', lng: '792.192', name: 'Van Horn Stable', category: 'Stable' },
    { lat: '2541.533', lng: '809.692', name: 'Roanoke Tribe', category: 'Tribe' },
    { lat: '2924.794', lng: '1451.312', name: 'Annesburg Mines', category: 'Mines' },
    { lat: '2886.958', lng: '1359.385', name: 'Annesburg Blacksmith', category: 'Blacksmith' },
    { lat: '2951.023', lng: '1321.770', name: 'Annesburg Gunsmith', category: 'Gunsmith' },
    { lat: '2917.523', lng: '1381.770', name: 'The Regulators Bounty Guild', category: 'Bounty Guild' },
    { lat: '-1893.479', lng: '1332.963', name: 'The Nightkin Clan Tribe', category: 'Tribe' },
    { lat: '2538.898', lng: '-1277.799', name: 'Saint Denis Theater', category: 'Unique' },
    { lat: '-176.193', lng: '628.389', name: 'Valentine Train Co.', category: 'Unique' },
    { lat: '-3729.003', lng: '-2601.103', name: 'New Austin Train Co.', category: 'Unique' },
  ],
  markerCategories: {
    'Gov Shops': 'Gov Shops',
    'Sale Barns': 'Sale Barns',
    'Stable': 'Stable',
    'Blacksmith': 'Blacksmith',
    'Tailor': 'Tailor',
    'Gunsmith': 'Gunsmith',
    'Pharmacy': 'Pharmacy',
    'Bakery': 'Bakery',
    'Undertaker': 'Undertaker',
    'General Store': 'General Store',
    'Saloon': 'Saloon',
    'Church': 'Church',
    'Lumberjack': 'Lumberjack',
    'Mines': 'Mines',
    'Brewery': 'Brewery',
    'Bounty Guild': 'Bounty Guild',
    'Tribe': 'Tribe',
    'Farm': 'Farm',
    'Unique': 'Unique',
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
        const checkbox = $(`<label>${category}</label> 
            <div class="input-checkbox-wrapper">
                <input class="input-checkbox" type="checkbox" name="checkbox-${category}" value="${category}" id="checkbox-${category}">
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

    // Clear all filters at start (unchecking all checkboxes)
    this.currentFilters = [];
    MapBase.filterMarkers();
  },

  gameToMapAndMark: function (lat, lng, name, category) {
    const lati = (0.01552 * lng + -63.6).toFixed(4);
    const long = (0.01552 * lat + 111.29).toFixed(4);
    
    // Pass category to markMap
    MapBase.markMap(lati, long, name, category);  
    
    return { name, lati, long };
  },


  gameToMapAndMarkTepo: function (lat, lng, name, category) {
    const lati = (0.01552 * lng + -63.6).toFixed(4);
    const long = (0.01552 * lat + 111.29).toFixed(4);
    MapBase.markMapTepo(lati, long, name, category);
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

  markMap: function (lat, long, name, category) {
    // Define a mapping of categories to custom icons
    const iconMap = {
        'Sale Barns': 'images/blip-sale-barn.png',
        'Ranches': 'images/blip-ranch.png',
        'Gov Shops': 'images/blip-shop.png',
        'Society Business': 'images/blip-society.png',
        'Default': 'images/blip-default.png',
        'Stable': 'images/blip-society.png',
        'Blacksmith': 'images/blip-society.png',
        'Tailor': 'images/blip-society.png',
        'Gunsmith': 'images/blip-society.png',
        'Pharmacy': 'images/blip-society.png',
        'Bakery': 'images/blip-society.png',
        'Undertaker': 'images/blip-society.png',
        'General Store': 'images/blip-society.png',
        'Saloon': 'images/blip-society.png',
        'Church': 'images/blip-society.png',
        'Lumberjack': 'images/blip-society.png',
        'Mines': 'images/blip-society.png',
        'Brewery': 'images/blip-society.png',
        'Bounty Guild': 'images/blip-society.png',
        'Tribe': 'images/blip-society.png',
        'Farm': 'images/blip-society.png',
        'Unique': 'images/blip-society.png'
    };

    // Choose the correct icon based on category, or use the default if not listed
    var icon = L.icon({
        iconUrl: iconMap[category] || iconMap['Default'],  
        iconSize: [32, 32], 
        iconAnchor: [16, 32]  
    });

    var marker = L.marker([lat, long], { icon: icon }).addTo(MapBase.markersGroup);
    marker.bindPopup(`<b>${name}</b>`);
},

markMapTepo: function (lat, long, name, category) {
  const iconMap = {
      'Sale Barns': 'images/blip-sale-barn.png',
      'Ranches': 'images/blip-ranch.png',
      'Gov Shops': 'images/blip-shop.png',
      'Default': 'images/blip-default.png'
  };

  const iconUrl = iconMap[category] || iconMap['Default'];

  const icon = L.divIcon({
      className: 'coord-label-icon',
      html: `
          <div class="coord-icon-wrapper">
              <img src="${iconUrl}" class="coord-icon-img" />
              ${name === '1' || name === '2' ? `<div class="coord-label">${name}</div>` : ''}
          </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
  });

  this.map.addLayer(MapBase.markersTepoGroup);
  const marker = L.marker([lat, long], { icon: icon }).addTo(MapBase.markersTepoGroup);
  marker.bindPopup(`<b>${name}</b>`);
},


  addCoordsOnMap: function (coords) {

    var xy = MapBase.mapToGame(coords.latlng.lat.toFixed(4), coords.latlng.lng.toFixed(4))
    $('.lat-lng-container').css('display', 'block');

    $('.lat-lng-container p').html(`
      X: ${xy.long}
      <br>Y: ${xy.lati}
  `);

    $('#lat-lng-container-close-button').click(function () {
      $('.lat-lng-container').css('display', 'none');
    });
  },

  markerPoints: function (coords1, coords2) {
    var c1 = coords1.replace('vector3(', '').replace(')', '').split(',');
    MapBase.gameToMapAndMarkTepo(parseFloat(c1[0]), parseFloat(c1[1]), '1', 'Default');

    var c2 = coords2.replace('vector3(', '').replace(')', '').split(',');
    MapBase.gameToMapAndMarkTepo(parseFloat(c2[0]), parseFloat(c2[1]), '2', 'Default');
},

  filterMarkers: function () {
    this.markersGroup.clearLayers();
    this.filtersData.forEach(marker => {
      if (this.currentFilters.includes(marker.category)) {
        this.gameToMapAndMark(marker.lat, marker.lng, marker.name, marker.category);
      }
    });
  },

};

MapBase.init();


$('.line').click(function () {
  var text1 = $('.coords1').val().trim();  // Get user input
  var text2 = $('.coords2').val().trim();

  // Easter Egg: Check if "80085" is entered
  if (text1 === "80085" || text2 === "80085") {
      console.log("Easter egg triggered! 🎉");
      showEasterEgg();
      return;  // Stop the normal map search
  }

  // Continue normal map search if no Easter egg match
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
          MapBase.gameToMapAndMarkTepo(coords.x, coords.y, `${name} (ID: ${id})`, "Ranches");
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

let rulerPoints = [];
let rulerLine = null;
let rulerLabel = null;
let radiusCenter = null;
let radiusCircle = null;
let radiusLabel = null;
let radiusCenterPin = null;  // Add a reference to the center pin

let activeTool = null;  // Variable to track the currently active tool

// Side Menu buttons
const toggleRulerButton = document.getElementById('toggleRuler');
const toggleRadiusButton = document.getElementById('toggleRadius');

// Activate the Ruler tool
function activateRulerTool() {
  if (!MapBase || !MapBase.map) {
    console.error("MapBase.map is not initialized!");
    return;
  }

  deactivateTool();  // Deactivate any active tool first

  activeTool = 'ruler';  // Mark ruler as active
  MapBase.map.on('click', onRulerClick);
  console.log("Ruler tool activated. Click two points to measure distance.");
  toggleRulerButton.innerText = 'Disable Ruler';  // Update button text
}

// Activate the Radius tool
function activateRadiusTool() {
  if (!MapBase || !MapBase.map) {
    console.error("MapBase.map is not initialized!");
    return;
  }

  deactivateTool();  // Deactivate any active tool first

  activeTool = 'radius';  // Mark radius as active
  MapBase.map.on('click', onRadiusClick);
  console.log("Radius tool activated. Click on a point to define the center.");
  toggleRadiusButton.innerText = 'Disable Radius';  // Update button text

  // Adjust zoom level when radius tool is activated
  MapBase.map.setZoom(5);  // Set the zoom level to something higher
}

// Deactivate the active tool
function deactivateTool() {
  if (!MapBase || !MapBase.map) return;

  if (activeTool === 'ruler') {
    MapBase.map.off('click', onRulerClick);
    clearRuler();
    toggleRulerButton.innerText = 'Enable Ruler';  // Update button text
  } else if (activeTool === 'radius') {
    MapBase.map.off('click', onRadiusClick);
    clearRadius();
    toggleRadiusButton.innerText = 'Enable Radius';  // Update button text
    radiusCenter = null;  // Reset the radius center when deactivating the radius tool
    console.log("Radius center cleared.");
  }
  
  activeTool = null;  // Reset active tool
  console.log("Tool deactivated.");
}

// Ruler tool logic
function onRulerClick(event) {
  if (!event || !event.latlng) {
    console.error("Invalid click event detected.");
    return;
  }

  const { lat, lng } = event.latlng;
  console.log(`Clicked at: ${lat}, ${lng}`);

  if (rulerPoints.length === 0) {
    // Clear previous measurement when starting a new one
    clearRuler();
  }

  rulerPoints.push({ x: lng, y: lat });

  if (rulerPoints.length === 2) {
    console.log("Two points selected, drawing ruler...");
    drawRuler();
  }
}

function drawRuler() {
  if (!MapBase || !MapBase.map || rulerPoints.length < 2) {
    console.error("MapBase.map is not initialized or insufficient points.");
    return;
  }

  const [point1, point2] = rulerPoints;
  const rawDistance = calculateDistance(point1, point2);
  const realWorldDistance = rawDistance * 64.5;  // Apply the scale factor

  console.log(`Raw distance: ${rawDistance.toFixed(2)} units`);
  console.log(`Real-world distance: ${realWorldDistance.toFixed(2)} units`);

  // Remove previous elements if they exist
  clearRuler();

  // Draw the measurement line
  rulerLine = L.polyline([[point1.y, point1.x], [point2.y, point2.x]], { color: 'red' })
    .addTo(MapBase.map);

  console.log("Line drawn between points.");

  // Place label at the midpoint
  const midPoint = { x: (point1.x + point2.x) / 2, y: (point1.y + point2.y) / 2 };
  rulerLabel = L.marker([midPoint.y, midPoint.x], {
    icon: L.divIcon({
      className: 'ruler-label',
      html: `<div style="background: white; padding: 0px 30px; border: 1px solid black; display: flex; justify-content: center; align-items: center; text-align: center;">${realWorldDistance.toFixed(2)} units</div>`
    })
  }).addTo(MapBase.map);

  console.log("Label added at midpoint.");

  // Reset points for next measurement
  rulerPoints = [];
}

function clearRuler() {
  console.log("Clearing previous ruler elements...");
  if (rulerLine) {
    MapBase.map.removeLayer(rulerLine);
    rulerLine = null;
  }
  if (rulerLabel) {
    MapBase.map.removeLayer(rulerLabel);
    rulerLabel = null;
  }
}

// Radius tool logic
function onRadiusClick(event) {
  if (!event || !event.latlng) {
    console.error("Invalid click event detected.");
    return;
  }

  const { lat, lng } = event.latlng;
  console.log(`Clicked at: ${lat}, ${lng}`);

  if (!radiusCenter) {
    // Set the center of the circle
    radiusCenter = { x: lng, y: lat };
    console.log("Radius center set.");

    // Optionally, draw a marker at the center
    radiusCenterPin = L.marker([lat, lng]).addTo(MapBase.map).bindPopup("Radius center").openPopup();
  } else {
    // Calculate the radius in map units
    const radius = calculateDistance(radiusCenter, { x: lng, y: lat });
    console.log(`Radius calculated: ${radius.toFixed(2)} units`);
    drawRadius(radius);
  }
}

function drawRadius(radius) {
  if (!MapBase || !MapBase.map) {
    console.error("MapBase.map is not initialized.");
    return;
  }

  // Ensure that radiusCenter is valid before using it
  if (!radiusCenter || radiusCenter.x == null || radiusCenter.y == null) {
    console.error("Invalid radiusCenter at the time of drawing circle.");
    return;
  }

  console.log(`Drawing circle at (${radiusCenter.y}, ${radiusCenter.x}) with radius: ${radius.toFixed(2)} units`);

  // Apply the scale factor only to the label text, not to the circle radius
  const realWorldRadius = radius * 64.5;  // Apply scaling to the radius text
  const realWorldDiameter = realWorldRadius * 2;  // Calculate diameter

  // Log the real-world radius and diameter for debugging purposes
  console.log("Real-world radius:", realWorldRadius.toFixed(2));
  console.log("Real-world diameter:", realWorldDiameter.toFixed(2));

  // Clear any existing radius elements before drawing a new one
  clearRadius();

  // Draw the circle at the radiusCenter location with the original radius (no scaling)
  if (radiusCenter && radiusCenter.y != null && radiusCenter.x != null) {
    radiusCircle = L.circle([radiusCenter.y, radiusCenter.x], {
      color: 'blue',
      fillColor: 'blue',
      fillOpacity: 0.2,
      radius: radius  // Use the original radius
    }).addTo(MapBase.map);

    console.log(`Circle drawn with radius: ${radius} units at location: (${radiusCenter.y}, ${radiusCenter.x})`);

    // Add a label with both the scaled radius and diameter
    const label = L.divIcon({
      className: 'radius-label',
      html: `<div style="background: white; padding: 5px 10px; border: 2px solid black; border-radius: 5px; text-align: center; font-weight: bold; width: auto; display: inline-block; min-width: 50px;">
               Radius: ${realWorldRadius.toFixed(2)} units<br>
               Diameter: ${realWorldDiameter.toFixed(2)} units
            </div>`
    });

    // Create a marker for the label and position it at the center of the circle
    radiusLabel = L.marker([radiusCenter.y, radiusCenter.x], { icon: label }).addTo(MapBase.map);

    console.log("Label added with radius and diameter units.");
  } else {
    console.error("Invalid radiusCenter when attempting to draw the circle.");
  }
}

// Clear previous radius and label
function clearRadius() {
  console.log("Clearing previous radius elements...");

  if (radiusCircle) {
    MapBase.map.removeLayer(radiusCircle);
    radiusCircle = null;
  }

  if (radiusLabel) {
    MapBase.map.removeLayer(radiusLabel);  // Remove the label as well
    radiusLabel = null;
  }

  if (radiusCenterPin) {
    MapBase.map.removeLayer(radiusCenterPin);  // Remove the center pin
    radiusCenterPin = null;
  }

  // Do not reset radiusCenter here, it's already reset in deactivateTool
  console.log("Previous radius elements cleared.");
}

function calculateDistance(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy); // Euclidean distance
}

// Event listeners for toggle buttons
toggleRulerButton.addEventListener('click', () => {
  if (activeTool === 'ruler') {
    deactivateTool();
  } else {
    activateRulerTool();
  }
});

toggleRadiusButton.addEventListener('click', () => {
  if (activeTool === 'radius') {
    deactivateTool();
  } else {
    activateRadiusTool();
  }
});

function showEasterEgg() {
  // Create the GIF overlay element
  const gifOverlay = document.createElement('div');
  gifOverlay.style.position = 'fixed';
  gifOverlay.style.top = '50%';
  gifOverlay.style.left = '50%';
  gifOverlay.style.transform = 'translate(-50%, -50%)';
  gifOverlay.style.zIndex = '1000';
  gifOverlay.style.pointerEvents = 'none';  // So it doesn't interfere with interactions
  gifOverlay.innerHTML = `<img src="https://media.giphy.com/media/qW3iR9I30ndCM/giphy.gif" style="width:400px; height:auto;">`;

  document.body.appendChild(gifOverlay);

  // Remove the GIF after 3 seconds
  setTimeout(() => {
      gifOverlay.remove();
  }, 3000);
}

window.onload = () => {
  // Initially, you can activate either tool if needed
  // activateRulerTool();  // For now, it's set to ruler tool by default
};

// Add this to your existing map.js file, after the MapBase object initialization

// Zombie spawn locations
const zombieSpawns = [
    {id: 5, x: -5281.9921, y: -2930.6301, z: 1.9963, radius: 50.0, name: "TW Bridge"},
    {id: 2, x: -5022.7128, y: -2694.9648, z: -12.1111, radius: 50.0, name: "TW train crossing"},
    {id: 3, x: -4574.2744, y: -2975.6218, z: -17.7776, radius: 50.0, name: "New Austin"},
    {id: 4, x: -4629.6870, y: -2719.4907, z: -10.4171, radius: 50.0, name: "New Austin"},
    {id: 5, x: -3785.3393, y: -2709.7497, z: -14.3901, radius: 50.0, name: "Outside Dillo South"},
    {id: 6, x: -2942.9067, y: -2905.9504, z: 59.5215, radius: 50.0, name: "Hill North of Dillo"},
    {id: 7, x: -2165.7280, y: -2493.8452, z: 65.5920, radius: 50.0, name: "Outside McGavins Ranch"},
    {id: 8, x: -1554.3774, y: -2449.4182, z: 42.9150, radius: 50.0, name: "Outside Thieves Landing South"},
    {id: 9, x: -1722.5775, y: -2018.2022, z: 49.4344, radius: 50.0, name: "Montana River North"},
    {id: 10, x: -1085.1625, y: -1504.9953, z: 65.1802, radius: 50.0, name: "Blackwater South"},
    {id: 11, x: -1190.1800, y: -1219.8283, z: 73.0413, radius: 50.0, name: "Blackwater North"},
    {id: 12, x: -1447.7717, y: -538.9178, z: 130.7626, radius: 50.0, name: "Strawberry South"},
    {id: 13, x: 47.7463, y: 571.3731, z: 134.0064, radius: 50.0, name: "Valentine South"},
    {id: 14, x: -560.2117, y: 465.2874, z: 98.7862, radius: 50.0, name: "Valentine West"},
    {id: 15, x: -44.6693, y: 1075.0067, z: 168.5802, radius: 50.0, name: "Valentine North"},
    {id: 16, x: 790.2110, y: -225.4016, z: 104.7358, radius: 50.0, name: "Mines West"},
    {id: 17, x: 1409.4272, y: 198.5566, z: 91.964, radius: 50.0, name: "Emerald South"},
    {id: 18, x: 1424.1964, y: 318.6251, z: 88.5511, radius: 50.0, name: "Emerald North"},
    {id: 19, x: 1478.1851, y: -1043.6546, z: 54.8668, radius: 50.0, name: "Rhodes East"},
    {id: 20, x: 931.4141, y: -1150.5604, z: 54.0688, radius: 50.0, name: "Rhodes West"},
    {id: 21, x: 2166.2207, y: -963.7087, z: 42.7042, radius: 50.0, name: "SD North West"},
    {id: 22, x: 2133.1782, y: -1321.2801, z: 42.4151, radius: 50.0, name: "SD West"},
    {id: 23, x: 2589.6855, y: -857.5442, z: 42.1633, radius: 50.0, name: "SD North"},
    {id: 24, x: 2552.3940, y: -183.2867, z: 43.1472, radius: 50.0, name: "Bluewater Marsh"},
    {id: 25, x: 2831.2460, y: 930.2058, z: 48.4911, radius: 50.0, name: "Annesburg South"},
    {id: 26, x: 682.9743, y: 1435.0292, z: 181.0608, radius: 50.0, name: "Cumberland Forest North"},
    {id: 27, x: -812.0164, y: 1187.8015, z: 156.3528, radius: 50.0, name: "Big Valley"},
    {id: 28, x: -2685.7973, y: -307.5009, z: 150.0588, radius: 50.0, name: "Owajina"},
    {id: 29, x: -1999.8850, y: 492.8249, z: 119.3719, radius: 50.0, name: "Little Creek"},
    {id: 30, x: 1428.4412, y: -1211.1064, z: 183.0512, radius: 50.0, name: "Moonstone Pond"},
    {id: 31, x: 172.441, y: 1886.865, z: 203.715, radius: 50.0, name: "Cotorro Springs"},
    {id: 32, x: -1841.670, y: 1825.084, z: 237.215, radius: 50.0, name: "Lake Isabella"}
];

// Vampire spawn locations
const vampireSpawns = [
    {id: 5, x: 1408.6207, y: -1358.2316, z: 81.0944, radius: 50.0, name: "Rhodes #1"},
    {id: 2, x: 1240.9350, y: -1253.0350, z: 73.8919, radius: 50.0, name: "Rhodes #2"},
    {id: 3, x: 2725.0219, y: -1073.9533, z: 46.8910, radius: 50.0, name: "Saint Denis #1"},
    {id: 4, x: 2831.7788, y: -1229.4315, z: 47.6538, radius: 50.0, name: "Saint Denis #2"},
    {id: 5, x: 2721.0214, y: -1250.9909, z: 49.9010, radius: 50.0, name: "Saint Denis #3"},
    {id: 6, x: 2501.9177, y: -1161.3874, z: 49.1520, radius: 50.0, name: "Saint Denis #4"},
    {id: 7, x: 2538.5368, y: -1465.4688, z: 46.3205, radius: 50.0, name: "Saint Denis #5"},
    {id: 8, x: 2953.8291, y: -1305.3500, z: 44.4855, radius: 50.0, name: "Annesburg #1"},
    {id: 9, x: 2864.4455, y: -1348.5880, z: 61.6905, radius: 50.0, name: "Annesburg #2"},
    {id: 10, x: -215.2876, y: 632.9640, z: 113.1784, radius: 50.0, name: "Valentine #1"},
    {id: 11, x: -259.8282, y: 793.8422, z: 118.3944, radius: 50.0, name: "Valentine #2"},
    {id: 12, x: -367.5848, y: 744.4501, z: 116.1424, radius: 50.0, name: "Valentine #3"},
    {id: 13, x: -1776.0712, y: -415.6216, z: 115.1124, radius: 50.0, name: "Strawberry #1"},
    {id: 14, x: -1816.8107, y: -397.3391, z: 161.6050, radius: 50.0, name: "Strawberry #2"},
    {id: 15, x: -798.3451, y: -1234.8284, z: 43.8870, radius: 50.0, name: "Blackwater #1"},
    {id: 16, x: -865.1370, y: -1351.0942, z: 43.3234, radius: 50.0, name: "Blackwater #2"},
    {id: 17, x: -733.6233, y: -1357.8681, z: 43.9944, radius: 50.0, name: "Blackwater #3"},
    {id: 18, x: -3625.5292, y: -2573.2180, z: -13.7586, radius: 50.0, name: "Armadillo"},
    {id: 19, x: 461.787, y: 2213.301, z: 246.190, radius: 50.0, name: "Wapiti"},
    {id: 20, x: -1315.231, y: 2364.796, z: 305.610, radius: 50.0, name: "Colter"}
];

// Add layer groups for spawns
MapBase.zombieSpawnGroup = L.layerGroup();
MapBase.vampireSpawnGroup = L.layerGroup();

// Function to add spawn markers
MapBase.addSpawnMarkers = function() {
    // Clear existing spawn markers
    this.zombieSpawnGroup.clearLayers();
    this.vampireSpawnGroup.clearLayers();

    // Add zombie spawns (green markers)
    zombieSpawns.forEach(spawn => {
        const mapCoords = this.gameToMapCoords(spawn.x, spawn.y);
        
        const icon = L.divIcon({
            className: 'spawn-marker zombie-spawn',
            html: `
                <div style="
                    width: 20px; 
                    height: 20px; 
                    background-color: rgba(0, 255, 0, 0.6); 
                    border: 2px solid #00ff00; 
                    border-radius: 50%;
                    box-shadow: 0 0 10px rgba(0, 255, 0, 0.8);
                "></div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const marker = L.marker([mapCoords.lat, mapCoords.lng], { icon: icon })
            .addTo(this.zombieSpawnGroup);
        
        marker.bindPopup(`
            <b>Zombie Spawn #${spawn.id}</b><br>
            ${spawn.name}<br>
            Radius: ${spawn.radius}m<br>
            X: ${spawn.x.toFixed(2)}<br>
            Y: ${spawn.y.toFixed(2)}<br>
            Z: ${spawn.z.toFixed(2)}
        `);

        // Add radius circle
        const radiusCircle = L.circle([mapCoords.lat, mapCoords.lng], {
            color: '#00ff00',
            fillColor: '#00ff00',
            fillOpacity: 0.1,
            radius: spawn.radius * 0.01552, // Convert game units to map units
            weight: 1
        }).addTo(this.zombieSpawnGroup);
    });

    // Add vampire spawns (red markers)
    vampireSpawns.forEach(spawn => {
        const mapCoords = this.gameToMapCoords(spawn.x, spawn.y);
        
        const icon = L.divIcon({
            className: 'spawn-marker vampire-spawn',
            html: `
                <div style="
                    width: 20px; 
                    height: 20px; 
                    background-color: rgba(255, 0, 0, 0.6); 
                    border: 2px solid #ff0000; 
                    border-radius: 50%;
                    box-shadow: 0 0 10px rgba(255, 0, 0, 0.8);
                "></div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const marker = L.marker([mapCoords.lat, mapCoords.lng], { icon: icon })
            .addTo(this.vampireSpawnGroup);
        
        marker.bindPopup(`
            <b>Vampire Spawn #${spawn.id}</b><br>
            ${spawn.name}<br>
            Radius: ${spawn.radius}m<br>
            X: ${spawn.x.toFixed(2)}<br>
            Y: ${spawn.y.toFixed(2)}<br>
            Z: ${spawn.z.toFixed(2)}
        `);

        // Add radius circle
        const radiusCircle = L.circle([mapCoords.lat, mapCoords.lng], {
            color: '#ff0000',
            fillColor: '#ff0000',
            fillOpacity: 0.1,
            radius: spawn.radius * 0.01552, // Convert game units to map units
            weight: 1
        }).addTo(this.vampireSpawnGroup);
    });

    // Add layers to map
    this.map.addLayer(this.zombieSpawnGroup);
    this.map.addLayer(this.vampireSpawnGroup);
};

// Helper function to convert game coordinates to map coordinates
MapBase.gameToMapCoords = function(gameX, gameY) {
    const lat = (0.01552 * gameY + -63.6);
    const lng = (0.01552 * gameX + 111.29);
    return { lat: lat, lng: lng };
};

// Add toggle controls to the filter section
MapBase.initSpawnControls = function() {
    const filterContainer = $('.filters');
    
    // Add spawn toggles
    const spawnControls = $(`
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #ccc;">
            <h3 style="margin-bottom: 10px;">Spawn Locations</h3>
            <label>Zombie Spawns</label>
            <div class="input-checkbox-wrapper">
                <input class="input-checkbox" type="checkbox" id="toggle-zombies" checked>
                <label class="input-checkbox-label" for="toggle-zombies"></label>
            </div><br>
            <label>Vampire Spawns</label>
            <div class="input-checkbox-wrapper">
                <input class="input-checkbox" type="checkbox" id="toggle-vampires" checked>
                <label class="input-checkbox-label" for="toggle-vampires"></label>
            </div>
        </div>
    `).appendTo(filterContainer);

    // Toggle zombie spawns
    $('#toggle-zombies').change(function() {
        if (this.checked) {
            MapBase.map.addLayer(MapBase.zombieSpawnGroup);
        } else {
            MapBase.map.removeLayer(MapBase.zombieSpawnGroup);
        }
    });

    // Toggle vampire spawns
    $('#toggle-vampires').change(function() {
        if (this.checked) {
            MapBase.map.addLayer(MapBase.vampireSpawnGroup);
        } else {
            MapBase.map.removeLayer(MapBase.vampireSpawnGroup);
        }
    });
};

// Initialize spawn markers after map is ready
// Add this at the end of MapBase.init() function, just before the closing brace:
// MapBase.addSpawnMarkers();
// MapBase.initSpawnControls();

// OR call it manually after MapBase.init() completes:
$(document).ready(function() {
    MapBase.addSpawnMarkers();
    MapBase.initSpawnControls();
});