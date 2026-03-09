// @ts-nocheck 
"use client"
import React from 'react'
import dynamic from 'next/dynamic'

const Chart = dynamic(()=>import('react-apexcharts'),{ssr:false})

export default function ProductChart() {

    let options = {
        chart: {
            height: 320,
            type: 'donut',
        },
        series: [45, 21, 23, 28],
        labels: ["Item 1", "Item 2", "Item 3", "Item 4"],
        legend: {
            show: true,
            position: 'bottom',
            offsetY: 0,
        },
        dataLabels: {
            enabled: true,
            dropShadow: {
                enabled: false,
            }
        },
        stroke: {
            show: true,
            colors: ['transparent'],
        },
        // dataLabels: {
        //     enabled: false,
        // },
        theme: {
            monochrome: {
                enabled: true,
                color: '#4f46e5',
            }
        },
        responsive: [{
            breakpoint: 768,
            options: {
                chart: {
                    height: 400,
                },
            }
        }]
    }

  return (
    <Chart options={options} series={options.series} type='donut' height={320}/>
  )
}