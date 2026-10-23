# Runtime assets

- Leaflet 1.9.4: https://github.com/Leaflet/Leaflet, BSD-2-Clause, license in `leaflet/LICENSE`.
- Leaflet.heat 0.2.0: https://github.com/Leaflet/Leaflet.heat, BSD-2-Clause, license in `leaflet/HEAT-LICENSE`.
- jsPDF 4.2.1: npm package `jspdf@4.2.1`, https://github.com/parallax/jsPDF, MIT, license in `jspdf/LICENSE`. The UMD file is copied unmodified from the published package; SHA-256 `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54`.
- `municipios.json`: geographic reference from https://github.com/tbrugz/geodata-br, as used in the approved local prototype.
- `bairros.json`: historical locality catalog from https://github.com/alanwillms/geoinfo, as used in the approved local prototype. Synthetic demonstration weights were removed. This is not a lead dataset or an official current boundary catalog.

These static libraries run inside the authenticated dashboard iframe. OSM street tiles are requested only through the authenticated, fixed-host proxy. No remote JavaScript or fonts are loaded.
