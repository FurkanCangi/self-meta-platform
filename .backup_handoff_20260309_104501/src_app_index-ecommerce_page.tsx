"use client"
import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'

import Wrapper from '../components/wrapper'
import SalesBtn from '../components/sales-btn'
import SalesChart from '../components/sales-chart'
import ProductChart from '../components/product-chart'
import Footer from '../components/footer'
import Switcher from '../components/switcher'

import {BiExport} from 'react-icons/bi'
import { FiArrowRight } from 'react-icons/fi';
import { HiOutlineArrowTrendingDown, HiOutlineArrowTrendingUp } from 'react-icons/hi2';


import SimpleBar from 'simplebar-react';
import CountUp from 'react-countup';

const TinySlider = dynamic(()=>import('tiny-slider-react'),{ssr:false})
import 'tiny-slider/dist/tiny-slider.css';

import { recentOrder, salesData, topProduct, topSeller, clientData } from '../data/data'
import { IconType } from 'react-icons'

interface RecentOrder{
    image: string;
    name: string;
    date: string;
    qty: string;
    price: string;
    status: string;
    payment: string;
}

interface SalesData{
    icon: IconType;
    title: string;
    amount: number;
    pre: string;
    today: string;
    status: string;
}

interface TopProduct{
    image: string;
    name: string;
    price: string;
    stock: number;
    order: number;
}

interface TopSeller{
    image: string;
    name: string;
    category: string[];
    items: string;
    rate: string;
}

interface ClientData{
    image: string;
    name: string;
    title: string;
    desc: string;
}

export default function Page() {

    const settings = {
        container: '.tiny-single-item',
        items: 1,
        controls: false,
        mouseDrag: true,
        loop: true,
        rewind: true,
        autoplay: true,
        autoplayButtonOutput: false,
        autoplayTimeout: 3000,
        navPosition: "bottom",
        speed: 400,
        gutter: 16,
      };

  return (
    <Wrapper>
       <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="flex justify-between items-center">
                    <div>
                        <h5 className="text-xl font-bold">E-Commerce Dashboard</h5>
                    </div>

                    <div className="flex items-center">
                        <div className="position-relative">
                            <select className="form-select form-input w-full py-2 px-2 h-10 bg-white dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-100 focus:border-gray-200 dark:border-gray-800 dark:focus:border-gray-700 focus:ring-0" id="yearchart">
                                <option value="Y">Yearly</option>
                                <option value="M">Monthly</option>
                                <option value="W">Weekly</option>
                                <option value="T">Today</option>
                            </select>
                        </div>

                        <Link href="" className="ms-1">
                            <span className="py-1.75 px-6 font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary/5 hover:bg-primary border-primary/10 hover:border-primary text-primary hover:text-white rounded-md sm:inline-block hidden"><BiExport className="inline"/> Export</span>

                            <span className="size-10 items-center justify-center tracking-wide align-middle duration-500 text-base text-center rounded-md border bg-primary/5 hover:bg-primary border-primary/10 hover:border-primary text-primary hover:text-white sm:hidden inline-flex"><BiExport className=""/></span>
                        </Link>
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 grid-cols-1 mt-6 gap-6">
                    <div className="xl:col-span-8 col-span-12">
                        <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                                <h6 className="text-lg font-semibold">Sales & Revenue</h6>
                                
                                <div className="position-relative">
                                    <select className="form-select form-input w-full py-2 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-100 focus:border-gray-200 dark:border-gray-800 dark:focus:border-gray-700 focus:ring-0" id="yearchart">
                                        <option value="Y">Yearly</option>
                                        <option value="M">Monthly</option>
                                        <option value="W">Weekly</option>
                                        <option value="T">Today</option>
                                    </select>
                                </div>
                            </div>
                            <SalesChart/>
                        </div>
                    </div>

                    <div className="xl:col-span-4 col-span-12">
                        <div className="grid md:grid-cols-2 gap-6">
                            {salesData.map((item:SalesData,index:number)=>{
                                let Icon = item.icon
                                return(
                                    <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900" key={index}>
                                        <div className="p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center">
                                                    <span className="flex justify-center items-center rounded-md size-8 min-w-8 bg-primary/5 dark:bg-primary/10 shadow-sm shadow-primary/5 dark:shadow-primary/10 text-primary">
                                                        <Icon className="size-4"></Icon>
                                                    </span>

                                                    <span className="font-semibold block ms-3">{item.title}</span>
                                                </div>

                                                <SalesBtn/>
                                            </div>

                                            <span className="text-2xl font-semibold block mb-1"><CountUp end={item.amount}/></span>
                                            {item.status === "profit" &&
                                                <span className="text-emerald-600 text-sm ms-1 font-semibold flex"><HiOutlineArrowTrendingUp  className="me-1"/> {item.pre} <span className="text-slate-400">+{item.today} today</span></span>
                                            }
                                            {item.status === "loss" &&
                                                <span className="text-red-600 text-sm ms-1 font-semibold flex"><HiOutlineArrowTrendingDown  className="me-1"/>{item.pre} <span className="text-slate-400">+{item.today} today</span></span>
                                            }
                                        </div>

                                        <div className="px-5 py-4 bg-gray-50 dark:bg-slate-800">
                                            <Link href="#" className="relative inline-flex items-center font-semibold tracking-wide align-middle text-base text-center border-none after:content-[''] after:absolute after:h-px after:w-0 hover:after:w-full after:end-0 hover:after:end-auto after:bottom-0 after:start-0 after:transition-all after:duration-500 text-primary dark:text-white/70 hover:text-primary dark:hover:text-white after:bg-primary dark:after:bg-white duration-500">View data <FiArrowRight className="ms-1"></FiArrowRight></Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div> 
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 grid-cols-1 mt-6 gap-6">
                    <div className="xl:col-span-8 lg:col-span-6 col-span-12">
                        <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                                <div>
                                    <h6 className="text-lg font-semibold">Recent Orders</h6>
                                </div>
                                
                                <div className="position-relative">
                                    <select className="form-select form-input w-full py-2 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-100 focus:border-gray-200 dark:border-gray-800 dark:focus:border-gray-700 focus:ring-0" id="yearchart">
                                        <option value="T">Today</option>
                                        <option value="W">This Week</option>
                                        <option value="M">This Month</option>
                                        <option value="Y">This Year</option>
                                    </select>
                                </div>
                            </div>

                            <SimpleBar className="h-88" data-simplebar>
                                <table className="w-full text-start">
                                    <thead>
                                        <tr>
                                            <th className="p-4 font-semibold text-start min-w-45">Item</th>
                                            <th className="p-4 font-semibold text-center min-w-25">Date</th>
                                            <th className="p-4 font-semibold text-center">Qty</th>
                                            <th className="p-4 font-semibold text-center">Price</th>
                                            <th className="p-4 font-semibold text-center">Status</th>
                                            <th className="p-4 font-semibold text-end">Payment</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {recentOrder.map((item:RecentOrder,index:number)=>{
                                            return(
                                                <tr className="border-t border-gray-100 dark:border-gray-800" key={index}>
                                                    <td className="px-4 py-3 text-start">
                                                        <span className="flex items-center">
                                                            <Image src={item.image} width={40} height={50} className="rounded shadow-sm dark:shadow-gray-700 w-10" alt=""/>
                                                            <span className="ms-3">
                                                                <span className="block font-semibold">{item.name}</span>
                                                            </span>
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-3 text-center">{item.date}</td>
                                                    <td className="px-4 py-3 text-center">{item.qty}</td>
                                                    <td className="px-4 py-3 text-center">{item.price}</td>
                                                    <td className="px-4 py-3 text-center">{item.status}</td>
                                                    <td className={`px-4 py-3 text-end font-semibold  ${item.payment === 'Paid' ? 'text-emerald-600' : 'text-red-600'}`}>{item.payment}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </SimpleBar>
                        </div>
                    </div>

                    <div className="xl:col-span-4 lg:col-span-6 col-span-12">
                        <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                                <h6 className="text-lg font-semibold">Weekly Top Products</h6>
                                
                                <div className="position-relative">
                                    <select className="form-select form-input w-full py-2 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-100 focus:border-gray-200 dark:border-gray-800 dark:focus:border-gray-700 focus:ring-0" id="yearchart">
                                        <option value="Y">Yearly</option>
                                        <option value="M">Monthly</option>
                                        <option value="W">Weekly</option>
                                        <option value="T">Today</option>
                                    </select>
                                </div>
                            </div>
                            <div className='py-7'>
                                <ProductChart/>
                            </div>

                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-12 grid-cols-1 mt-6 gap-6">
                    <div className="lg:col-span-4">
                        <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                                <div>
                                    <h6 className="text-lg font-semibold">Top Products</h6>
                                </div>
                                
                                <div className="position-relative">
                                    <select className="form-select form-input w-full py-2 px-2 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-100 focus:border-gray-200 dark:border-gray-800 dark:focus:border-gray-700 focus:ring-0" id="yearchart">
                                        <option value="T">Today</option>
                                        <option value="W">This Week</option>
                                        <option value="M">This Month</option>
                                        <option value="Y">This Year</option>
                                    </select>
                                </div>
                            </div>

                            <SimpleBar className="h-85" data-simplebar>
                                <table className="w-full text-start">
                                    <thead>
                                        <tr>
                                            <th className="p-4 font-semibold text-start min-w-50">Product</th>
                                            <th className="p-4 font-semibold text-center">Price</th>
                                            <th className="p-4 font-semibold text-center">Stock</th>
                                            <th className="p-4 font-semibold text-end">Orders</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {topProduct.map((item:TopProduct,index:number)=>{
                                            return(
                                                <tr className="border-t border-gray-100 dark:border-gray-800" key={index}>
                                                    <td className="px-4 py-3 text-start">
                                                        <span className="flex items-center">
                                                            <Image src={item.image} width={40} height={50} className="rounded shadow-sm dark:shadow-gray-700 w-10" alt=""/>
                                                            <span className="ms-3">
                                                                <span className="block font-semibold">{item.name}</span>
                                                            </span>
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-3 text-center">{item.price}</td>
                                                    <td className="px-4 py-3 text-center">{item.stock}</td>
                                                    <td className="px-4 py-3 text-end">{item.order}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </SimpleBar>
                        </div>
                    </div>

                    <div className="lg:col-span-5">
                        <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="p-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                                <div>
                                    <h6 className="text-lg font-semibold">Top Seller</h6>
                                </div>
                                
                                <div className="position-relative">
                                    <select className="form-select form-input w-full py-2 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-100 focus:border-gray-200 dark:border-gray-800 dark:focus:border-gray-700 focus:ring-0" id="yearchart">
                                        <option value="T">Today</option>
                                        <option value="W">This Week</option>
                                        <option value="M">This Month</option>
                                        <option value="Y">This Year</option>
                                    </select>
                                </div>
                            </div>

                            <SimpleBar className="h-85" data-simplebar>
                                <table className="w-full text-start">
                                    <thead>
                                        <tr>
                                            <th className="p-4 font-semibold text-start min-w-45">Seller</th>
                                            <th className="p-4 font-semibold text-center min-w-30">Categories</th>
                                            <th className="p-4 font-semibold text-center min-w-30">Items</th>
                                            <th className="p-4 font-semibold text-end">Ratings</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {topSeller.map((item:TopSeller,index:number)=>{
                                            return(
                                                <tr className="border-t border-gray-100 dark:border-gray-800" key={index}>
                                                    <td className="px-4 py-3 text-start">
                                                        <Link href="" className="flex items-center hover:text-primary">
                                                            <Image src={item.image} width={32} height={32} className="rounded-full shadow-sm dark:shadow-gray-700 size-8" alt=""/>
                                                            <span className="ms-2">
                                                                <span className="block font-semibold">{item.name}</span>
                                                            </span>
                                                        </Link>
                                                    </td>

                                                    <td className="px-4 py-3 text-center">
                                                        <div>
                                                            {item.category.map((el,index)=>{
                                                                return(
                                                                    <Link href="#" className="bg-primary hover:bg-primary-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded h-5 ms-1" key={index}>{el}</Link>
                                                                )
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">{item.items}</td>
                                                    <td className="px-4 py-3 text-end font-semibold"><i className="mdi mdi-star text-amber-400"></i>{item.rate}</td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </SimpleBar>
                        </div>
                    </div>

                    <div className="lg:col-span-3">
                        <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="px-4 py-5.5 border-b border-gray-100 dark:border-gray-800">
                                <h6 className="text-lg font-semibold">Client Reviews</h6>
                            </div>

                            <SimpleBar className="h-85 p-4" data-simplebar>
                                <div className="tiny-single-item">
                                <TinySlider settings={settings}>
                                    {clientData.map((item:ClientData,index:number)=>{
                                        return(
                                            <div className="tiny-slide" key={index}>
                                                <div className="text-center">
                                                    <p className="text-lg text-slate-400 italic"> {item.desc} </p>
                
                                                    <div className="text-center mt-5">
                                                        <ul className="text-xl font-medium text-orange-500 list-none mb-2">
                                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                                            <li className="inline"><i className="mdi mdi-star"></i></li>
                                                        </ul>
                
                                                        <Image src={item.image} width={56} height={56} className="size-14 rounded-full shadow-md dark:shadow-gray-800 mx-auto" alt=""/>
                                                        <h6 className="mt-2 font-semibold">{item.name}</h6>
                                                        <span className="text-slate-400 text-sm">{item.title}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </TinySlider>
                                </div>
                            </SimpleBar>
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
  )
}
