// @ts-nocheck 
'use client'
import React, { useEffect } from "react";

import jsVectorMap from 'jsvectormap'
import 'jsvectormap/dist/maps/world'


const WorldMap = () => {

  useEffect(() => {
    new jsVectorMap({
        map: 'world',
        selector: '#map',
        zoomOnScroll: true,
        zoomButtons: false,
        selectedMarkers: [0, 1],
        markersSelectable: true,
        markers:[
            { name: "Palestine", coords: [31.9474,35.2272] },
            { name: "Russia", coords: [61.524,105.3188] },
            { name: "Canada", coords: [56.1304,-106.3468] },
            { name: "Greenland", coords: [71.7069,-42.6043] },
        ],
        markerStyle:{
            initial: { fill: "#4f46e5" },
            selected: { fill: "#059669" }
        },
        labels: {
            markers: {
            render: marker => marker.name
            }
        }
    });
  }, []);
  
    return (
      <div className='w-full h-59 jvm-container'>
        <div id="map" className="w-full h-59"></div>
      </div>
    );
  };
  
  export default WorldMap;