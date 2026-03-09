'use client'
import React from "react"
import Link from "next/link";
import CountUp from 'react-countup';


import {HiArrowTrendingDown,HiArrowTrendingUp } from 'react-icons/hi2'
import {FiArrowRight} from 'react-icons/fi'
import {IoAnalyticsSharp} from 'react-icons/io5'

import { profitData } from "../data/data";
import { Icon } from "react-feather";

interface ProftData{
    icon: Icon;
    title: string;
    amount: number;
    loss?: string;
    profit?: string;
    null?: string
}

export default function DataStates(){
    
    return(
        <div className="grid xl:grid-cols-5 md:grid-cols-3 grid-cols-1 mt-6 gap-6">
            {profitData.map((item:ProftData,index:number)=>{
                const Icons = item.icon
                return(
                    <div className="relative overflow-hidden rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900" key={index}>
                        <div className="p-5 flex items-center">
                            <span className="flex justify-center items-center rounded-md size-14 min-w-14 bg-primary/5 dark:bg-primary/10 shadow-sm shadow-primary/5 dark:shadow-primary/10 text-primary">
                                <Icons className="size-5"/>
                            </span>

                            <span className="ms-3">
                                <span className="text-slate-400 font-semibold block">{item.title}</span>
                                <span className="flex items-center justify-between mt-1">
                                    <span className="text-xl font-semibold"><span className="counter-value">$<CountUp start={0} end={item.amount}/></span></span>
                                    {item?.loss ?  <span className="text-red-600 text-sm ms-1 font-semibold flex items-center"><HiArrowTrendingDown className="me-1"/>{item?.loss}</span> : ''}
                                    {item?.profit ?  <span className="text-emerald-600 text-sm ms-1 font-semibold flex items-center"><HiArrowTrendingUp className="me-1"/>{item?.profit}</span> : ''}
                                    {item?.null ?  <span className="text-slate-400 text-sm ms-1 font-semibold flex items-center"><IoAnalyticsSharp className="me-1"/>{item?.null}</span> : ''}
                                    
                                </span>
                            </span>
                        </div>

                        <div className="px-5 py-4 bg-gray-50 dark:bg-slate-800">
                            <Link href="#" className="relative inline-flex items-center font-semibold tracking-wide align-middle text-base text-center border-none after:content-[''] after:absolute after:h-px after:w-0 hover:after:w-full after:end-0 hover:after:end-auto after:bottom-0 after:start-0 after:transition-all after:duration-500 text-primary dark:text-white/70 hover:text-primary dark:hover:text-white after:bg-primary dark:after:bg-white duration-500">View data <FiArrowRight className="ms-1"/></Link>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}