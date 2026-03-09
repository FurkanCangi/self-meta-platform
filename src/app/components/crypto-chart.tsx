// @ts-nocheck 
'use client'
import React from "react";
import Image from "next/image";
import dynamic from "next/dynamic";

const Chart  = dynamic(()=>import('react-apexcharts'),{ssr:false})

export default function CryptoChart(){
    const  options1 = {
        series: [{
            data: [20, 45, 40, 64, 35, 25, 35]
        }],
        chart: {
            type: 'area',
            height: 90,
            width: '100%',
            sparkline: {
                enabled: true
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        colors: ['#059669'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                inverseColors: false,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [20, 100, 100, 100]
            },
        },
        tooltip: {
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            y: {
                title: {
                    formatter: function () {
                        return ''
                    }
                }
            },
            marker: {
                show: false
            }
        }
    };
    const  options2 = {
        series: [{
            data: [10, 25, 30, 54, 45, 39, 15]
        }],
        chart: {
            type: 'area',
            height: 90,
            width: '100%',
            sparkline: {
                enabled: true
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        colors: ['#dc2626'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                inverseColors: false,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [20, 100, 100, 100]
            },
        },
        tooltip: {
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            y: {
                title: {
                    formatter: function () {
                        return ''
                    }
                }
            },
            marker: {
                show: false
            }
        }
    };
    const  options3 = {
        series: [{
            data: [15, 20, 10, 45, 20, 10, 5]
        }],
        chart: {
            type: 'area',
            height: 90,
            width: '100%',
            sparkline: {
                enabled: true
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        colors: ['#059669'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                inverseColors: false,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [20, 100, 100, 100]
            },
        },
        tooltip: {
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            y: {
                title: {
                    formatter: function () {
                        return ''
                    }
                }
            },
            marker: {
                show: false
            }
        }
    };
    const  options4 = {
        series: [{
            data: [3, 5, 7, 11, 8, 5, 7]
        }],
        chart: {
            type: 'area',
            height: 90,
            width: '100%',
            sparkline: {
                enabled: true
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        colors: ['#dc2626'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                inverseColors: false,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [20, 100, 100, 100]
            },
        },
        tooltip: {
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            y: {
                title: {
                    formatter: function () {
                        return ''
                    }
                }
            },
            marker: {
                show: false
            }
        }
    };
    const  options5 = {
        series: [{
            data: [20, 14, 24, 30, 16, 12, 8]
        }],
        chart: {
            type: 'area',
            height: 90,
            width: '100%',
            sparkline: {
                enabled: true
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        colors: ['#dc2626'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                inverseColors: false,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [20, 100, 100, 100]
            },
        },
        tooltip: {
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            y: {
                title: {
                    formatter: function () {
                        return ''
                    }
                }
            },
            marker: {
                show: false
            }
        }
    };
    const  options6 = {
        series: [{
            data: [4, 7, 15, 10, 8, 12, 18]
        }],
        chart: {
            type: 'area',
            height: 90,
            width: '100%',
            sparkline: {
                enabled: true
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        colors: ['#059669'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                inverseColors: false,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [20, 100, 100, 100]
            },
        },
        tooltip: {
            fixed: {
                enabled: false
            },
            x: {
                show: false
            },
            y: {
                title: {
                    formatter: function () {
                        return ''
                    }
                }
            },
            marker: {
                show: false
            }
        }
    };

   

    return(
        <div className="grid xl:grid-cols-6 md:grid-cols-3 grid-cols-1 mt-6 gap-6">
            <div className="relative overflow-hidden p-4 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                <div className="relative flex justify-between items-center mb-8 z-1">
                    <div className="flex items-center">
                        <Image src="/images/coin/kucoin.png" width={44} height={44} className="size-11 rounded-full shadow-sm dark:shadow-gray-700 p-1.5 me-1" alt=""/>
                        <h6 className="mb-0 font-semibold text-lg ms-2">Kucoin</h6>
                    </div>
                    <span className="text-slate-400 font-semibold">KCS</span>
                </div>

                <div className="relative flex justify-between items-center font-semibold z-1">
                    <span className="text-sm text-emerald-600">+15.55%</span>
                    <span className="text-sm text-emerald-600">+$ 155</span>
                    <span className="text-sm">$ 41245</span>
                </div>

                <div className="absolute p-4 inset-0 z-0 opacity-10">
                    <Chart options={options1} series={options1.series} type="area" width='100%' height={90} />
                </div>
            </div>

            <div className="relative overflow-hidden p-4 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                <div className="relative flex justify-between items-center mb-8 z-1">
                    <div className="flex items-center">
                        <Image src="/images/coin/ethereum.png" width={44} height={44} className="size-11 rounded-full shadow-sm dark:shadow-gray-700 p-1.5 me-1" alt=""/>
                        <h6 className="mb-0 font-semibold text-lg ms-2">Ethereum</h6>
                    </div>
                    <span className="text-slate-400 font-semibold">ETS</span>
                </div>

                <div className="relative flex justify-between items-center font-semibold z-1">
                    <span className="text-sm text-red-600">-25.01%</span>
                    <span className="text-sm text-red-600">-$ 524</span>
                    <span className="text-sm">$ 1458</span>
                </div>

                <div className="absolute p-4 inset-0 z-0 opacity-10">
                    <Chart options={options2} series={options1.series} type="area" width='100%' height={90} />
                </div>
            </div>

            <div className="relative overflow-hidden p-4 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                <div className="relative flex justify-between items-center mb-8 z-1">
                    <div className="flex items-center">
                        <Image src="/images/coin/monero.png" width={44} height={44} className="size-11 rounded-full shadow-sm dark:shadow-gray-700 p-1.5 me-1" alt=""/>
                        <h6 className="mb-0 font-semibold text-lg ms-2">Monero</h6>
                    </div>
                    <span className="text-slate-400 font-semibold">XMR</span>
                </div>

                <div className="relative flex justify-between items-center font-semibold z-1">
                    <span className="text-sm text-emerald-600">+3.08%</span>
                    <span className="text-sm text-emerald-600">+$ 58</span>
                    <span className="text-sm">$ 448</span>
                </div>

                <div className="absolute p-4 inset-0 z-0 opacity-10">
                    <Chart options={options3} series={options1.series} type="area" width='100%' height={90} />
                </div>
            </div>

            <div className="relative overflow-hidden p-4 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                <div className="relative flex justify-between items-center mb-8 z-1">
                    <div className="flex items-center">
                        <Image src="/images/coin/litecoin.png" width={44} height={44} className="size-11 rounded-full shadow-sm dark:shadow-gray-700 p-1.5 me-1" alt=""/>
                        <h6 className="mb-0 font-semibold text-lg ms-2">Litecoin</h6>
                    </div>
                    <span className="text-slate-400 font-semibold">LTC</span>
                </div>

                <div className="relative flex justify-between items-center font-semibold z-1">
                    <span className="text-sm text-red-600">-5.05%</span>
                    <span className="text-sm text-red-600">-$ 48</span>
                    <span className="text-sm">$ 478</span>
                </div>

                <div className="absolute p-4 inset-0 z-0 opacity-10">
                    <Chart options={options4} series={options1.series} type="area" width='100%' height={90} />
                </div>
            </div>

            <div className="relative overflow-hidden p-4 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                <div className="relative flex justify-between items-center mb-8 z-1">
                    <div className="flex items-center">
                        <Image src="/images/coin/blocknet.png" width={44} height={44} className="size-11 rounded-full shadow-sm dark:shadow-gray-700 p-1.5 me-1" alt=""/>
                        <h6 className="mb-0 font-semibold text-lg ms-2">Blocknet</h6>
                    </div>
                    <span className="text-slate-400 font-semibold">BLOCK</span>
                </div>

                <div className="relative flex justify-between items-center font-semibold z-1">
                    <span className="text-sm text-red-600">-8.05%</span>
                    <span className="text-sm text-red-600">-$ 58</span>
                    <span className="text-sm">$ 546</span>
                </div>

                <div className="absolute p-4 inset-0 z-0 opacity-10">
                    <Chart options={options5} series={options1.series} type="area" width='100%' height={90} />
                </div>
            </div>

            <div className="relative overflow-hidden p-4 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                <div className="relative flex justify-between items-center mb-8 z-1">
                    <div className="flex items-center">
                        <Image src="/images/coin/bittorrent.png" width={44} height={44} className="size-11 rounded-full shadow-sm dark:shadow-gray-700 p-1.5 me-1" alt=""/>
                        <h6 className="mb-0 font-semibold text-lg ms-2">Bittorrent</h6>
                    </div>
                    <span className="text-slate-400 font-semibold">BTT</span>
                </div>

                <div className="relative flex justify-between items-center font-semibold z-1">
                    <span className="text-sm text-emerald-600">+3.08%</span>
                    <span className="text-sm text-emerald-600">+$ 58</span>
                    <span className="text-sm">$ 448</span>
                </div>

                <div className="absolute p-4 inset-0 z-0 opacity-10">
                    <Chart options={options6} series={options1.series} type="area" width='100%' height={90} />
                </div>
            </div>
        </div>
    )
}