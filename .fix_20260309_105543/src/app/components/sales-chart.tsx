// @ts-nocheck 
"use client"
import React from 'react'
import dynamic from 'next/dynamic'

const Chart = dynamic(()=>import('react-apexcharts'),{ssr:false})

export default function SalesChart() {
    const  options1 = {
        series: [{
            name: 'Item Sales',
            data: [0, 100, 40, 110, 60, 140, 55, 130, 65, 180, 75, 115],
        }, {
            name: 'Revenue',
            data: [0, 45, 10, 75, 35, 94, 40, 115, 30, 105, 65, 110],
        }],
        chart: {
            height: 314,
            type: 'area',
            width: '100%',
            stacked: true,
            toolbar: {
              show: false,
              autoSelected: 'zoom'
            },
        },
        grid: {
            padding: {
              left: 0,
              right: 0
            },
            strokeDashArray: 4,
          },
          markers: {
            size: 0,
            hover: {
              size: 0
            }
          },
        plotOptions: {
            bar: {
                borderRadius: 5,
                horizontal: false,
                columnWidth: '40%',
                endingShape: 'rounded'
            },
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth',
            width: [1, 1],
            dashArray: [3, 3],
            lineCap: 'round',
        },
        colors: ['#4f46e5', '#16a34a'],
        xaxis: {
            type: 'month',
            categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            axisBorder: {
              show: true,
            },  
            axisTicks: {
              show: true,
            },
        },
      
        fill: {
            type: "gradient",
            gradient: {
              shadeIntensity: .8,
              opacityFrom: 0.5,
              opacityTo: 0.3,
              stops: [0, 80, 100]
            }
          },
          tooltip: {
            x: {
                format: 'dd/MM/yy HH:mm'
            },
            legend: {
                position: 'bottom',
                offsetY: 0,
              },
        },
    };

  return (
    <Chart options={options1} series={options1.series} type="area" width='100%' height={315} />
  )
}