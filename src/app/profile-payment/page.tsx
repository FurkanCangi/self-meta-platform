import React  from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import UserProfileTab from "../components/user-profile-tab";
import Wrapper from "../components/wrapper";

import * as Icon from 'react-feather'
 
import { paymentData } from "../data/data";

interface PaymentData{
    image: string;
    title: string;
    time: string;
}

export default function Page(){
    return(
    <Wrapper>
        <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="grid grid-cols-1">
                    <div className="profile-banner relative text-transparent rounded-md shadow-sm dark:shadow-gray-700 overflow-hidden">
                        <input id="pro-banner" name="profile-banner" type="file" className="hidden"/>
                        <div className="relative shrink-0">
                            <Image src='/images/blog/bg.jpg' width={0} height={0} sizes="100vw" placeholder="blur" blurDataURL="/images/blog/bg.jpg" style={{width:"100%", height:"auto"}} className="!h-80 w-full object-cover" id="profile-banner" alt=""/>
                            <div className="absolute inset-0 bg-slate-900/70"></div>
                            <label className="absolute inset-0 cursor-pointer" htmlFor="pro-banner"></label>
                        </div>
                    </div>
                </div>

                <div className="grid md:grid-cols-12 grid-cols-1">
                   <UserProfileTab/>
                    <div className="xl:col-span-9 lg:col-span-8 md:col-span-8 mt-6">
                        <div className="grid grid-cols-1 gap-6">
                            <div className="relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <div className="p-6 md:flex justify-between items-center border-b border-gray-100 dark:border-gray-700">
                                    <div className="mb-4 md:mb-0">
                                        <h5 className="text-xl font-semibold">Current Plan</h5>
                                    </div>
                                    <Link href="" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md">Switch to Annual Plan</Link>
                                </div>
    
                                <div className="p-6">
                                    <h5 className="text-2xl font-bold">$18/Monthly</h5>
                                    <p className="text-slate-400 mt-2">Your next monthly charge of $18 will be applied to your primary payment method on July 20, 2022.</p>
                                </div>
                            </div>

                            <div className="relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                                    <h5 className="text-xl font-semibold">Payment Methods</h5>
                                    <p className="text-slate-400 mt-2">Primary payment method is used by default</p>
                                </div>
    
                                <div className="px-6">
                                    <ul>
                                        {paymentData.map((item:PaymentData,index:number)=>{
                                            return(
                                                <li className="flex justify-between items-center py-6" key={index}>
                                                    <div className="flex items-center">
                                                        <Image src={item.image} width={48} height={32} className="rounded shadow-sm dark:shadow-gray-700 w-12" alt=""/>

                                                        <div className="ms-3">
                                                            <p className="font-semibold">{item.title}</p>
                                                            <p className="text-slate-400 text-sm">{item.time}</p>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <Link href="" className="size-9 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center bg-red-600/5 hover:bg-red-600 border-red-600/10 hover:border-red-600 text-red-600 hover:text-white rounded-full"><Icon.Trash2 className="size-4"/></Link>
                                                    </div>
                                                </li>
                                            )
                                        })}
                                        <li className="py-6 border-t border-gray-100 dark:border-gray-700">
                                            <Link href="#!" data-modal-toggle="paymentMethod" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md">Add Payment Method</Link>
                                        </li>
                                    </ul>
                                </div>
                            </div>
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