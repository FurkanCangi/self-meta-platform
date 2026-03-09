'use client'
import React from "react";
import Link from "next/link";

import SimpleBarReact from "simplebar-react";
import 'simplebar-react/dist/simplebar.min.css';

import { orderData } from "../data/data";
import { FiArrowRight } from "react-icons/fi";

interface OrderData{
    no: string;
    id: string;
    date: string;
    price: string;
    status: string;
}

export default function Order(){
    
    return(
        <>
            <div className="xl:col-span-5 lg:col-span-12">
                <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                    <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
                        <h6 className="text-lg font-semibold">Orders</h6>
                        
                        <Link href="#" className="relative inline-flex items-center font-semibold tracking-wide align-middle text-base text-center border-none after:content-[''] after:absolute after:h-px after:w-0 hover:after:w-full after:end-0 hover:after:end-auto after:bottom-0 after:start-0 after:transition-all after:duration-500 text-slate-400 dark:text-white/70 hover:text-primary dark:hover:text-white after:bg-primary dark:after:bg-white duration-500">View orders <FiArrowRight className="ms-1 text-sm"/></Link>
                    </div>
                    <SimpleBarReact className="max-h-100"> 
                        <div className="relative overflow-x-auto block w-full">
                            <table className="w-full text-start">
                                <thead className="text-base">
                                    <tr>
                                        <th className="text-start font-semibold text-[15px] p-4 min-w-25">No.</th>
                                        <th className="text-start font-semibold text-[15px] p-4 min-w-32">ID</th>
                                        <th className="text-start font-semibold text-[15px] p-4 min-w-32">Date</th>
                                        <th className="text-start font-semibold text-[15px] p-4 min-w-32">Price</th>
                                        <th className="text-end font-semibold text-[15px] p-4 min-w-32">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderData.map((item:OrderData, index:number) => {
                                        return(
                                            <tr key={index}>
                                                <th className="text-start border-t border-gray-100 dark:border-gray-800 p-4 font-semibold">{item.no}</th>
                                                <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">{item.id}</td>
                                                <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                                    <span className="text-slate-400">{item.date}</span>
                                                </td>
                                                <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                                    <span className="text-slate-400">{item.price}</span>
                                                </td>
                                                <td className="text-end border-t border-gray-100 dark:border-gray-800 p-4">
                                                    {item.status === 'Delivered' ?   <span className="bg-emerald-600/10 dark:bg-emerald-600/20 border border-emerald-600/10 dark:border-emerald-600/20 text-emerald-600 text-[12px] font-bold px-2.5 py-0.5 rounded h-5 ms-1">{item.status}</span> : ''}
                                                    {item.status === 'New Order' ?   <span className="bg-primary/10 dark:bg-primary/20 border border-primary/10 dark:border-primary/20 text-primary text-[12px] font-bold px-2.5 py-0.5 rounded h-5 ms-1">{item.status}</span> : ''}
                                                    {item.status === 'Return' ?   <span className="bg-red-600/10 dark:bg-red-600/20 border border-red-600/10 dark:border-red-600/20 text-red-600 text-[12px] font-bold px-2.5 py-0.5 rounded h-5 ms-1">{item.status}</span> : ''}
                                                    {item.status === 'Cancel' ?   <span className="bg-gray-500/5 border border-gray-500/5 text-gray-500 text-[12px] font-bold px-2.5 py-0.5 rounded h-5 ms-1">{item.status}</span> : ''}
                                                  
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </SimpleBarReact>
                </div>
            </div>
        </>
    )
}