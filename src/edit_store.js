'use strict';

/**
 * A store for keeping track of in progress
 * feature edits before they written into history
 * We also call draft rendering here
 *
 * @param {Map} map - an instance of mapboxgl.Map
 * @param {Array<Object>} [features] - an array of geojson features
 * @returns {EditStore} this
 * @private
 */
export default class EditStore {

  constructor(map, features) {
    this._map = map;
    this.features = features || [];

    this._map.on('new.edit', () => {
      this.render();
    });

    this._map.on('finish.edit', () => {
      this.features = [];
      this.render();
    });

    this._map.on('edit.end', e => {
      this.endEdit(e.geometry.drawId);
    });
  }

  add(geometry) {
    ////////////////////////////////////////////////////////
    ///////////////// CHECK FOR DUPES!!! ///////////////////
    ////////////////////////////////////////////////////////
    if (geometry instanceof Array) {
      this.features = this.features.concat(geometry);
    } else {
      this.features.push(geometry);
    }
    this.render();
  }

  getAll() {
    return this.features;
  }

  getAllGeoJSON() {
    return {
      type: 'FeatureCollection',
      features: this.features.map(feature => feature.getGeoJSON())
    };
  }

  get(id) {
    return this.features.filter(feat => feat.drawId === id)[0];
  }

  endEdit(id) {
    this.features = this.features.filter(feat => feat.drawId !== id);
    this.render();
  }

  clear() {
    this.features = [];
    this.render();
  }

  inProgress() {
    return this.features.length > 0;
  }

  _addVertices() {
    var vertices = [];

    for (var i = 0; i < this.features.length; i++) {
      var coords = this.features[i].getGeoJSON().geometry.coordinates;
      var type = this.features[i].getGeoJSON().geometry.type;
      if (type === 'LineString' || type === 'Polygon') {
        coords = type === 'Polygon' ? coords[0] : coords;
        var l = type === 'LineString' ? coords.length : coords.length - 1;
        for (var j = 0; j < l; j++) {
          vertices.push({
            type: 'Feature',
            properties: {
              meta: 'vertex',
              index: j
            },
            geometry: {
              type: 'Point',
              coordinates: coords[j]
            }
          });
        }
      }
    }

    return vertices;
  }

  _addMidpoints() {
    var midpoints = [];

    for (var i = 0; i < this.features.length; i++) {
      if (this.features[i].type === 'square') continue;

      var feat = this.features[i];
      var c = feat.getGeoJSON().geometry.coordinates;

      if (feat.getGeoJSON().geometry.type === 'LineString' ||
          feat.getGeoJSON().geometry.type === 'Polygon') {

        c = feat.getGeoJSON().geometry.type === 'Polygon' ? c[0] : c;

        for (var j = 0; j < c.length - 1; j++) {
          var ptA = this._map.project([ c[j][0], c[j][1] ]);
          var ptB = this._map.project([ c[j + 1][0], c[j + 1][1] ]);
          var mid = this._map.unproject([ (ptA.x + ptB.x) / 2, (ptA.y + ptB.y) / 2 ]);
          midpoints.push({
            type: 'Feature',
            properties: {
              meta: 'midpoint',
              index: j + 1
            },
            geometry: {
              type: 'Point',
              coordinates: [ mid.lng, mid.lat ]
            }
          });
        }

      }
    }

    return midpoints;
  }

  render() {
    var geom = this.getAllGeoJSON();
    geom.features = geom.features.concat(this._addVertices(), this._addMidpoints());
    this._map.fire('edit.feature.update', {
      geojson: geom
    });
  }

}