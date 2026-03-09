'use client'
import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import SimpleBarReact from "simplebar-react";
import 'simplebar-react/dist/simplebar.min.css';

export default function Chat(){
    let [manu, setManu] = useState<boolean>(false)

    useEffect(()=>{
        const closeManu = () => {
            setManu(false)
        }
        document.addEventListener('mousedown', closeManu)
    })
    return(
        <div className="xl:col-span-4 lg:col-span-6">
            <div className="rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 p-4">
                    <div className="flex">
                        <Image src='/images/client/01.jpg' height={44} width={44} placeholder="blur" blurDataURL="/images/client/01.jpg" className="size-11 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                        <div className="overflow-hidden ms-3">
                            <Link href="#" className="block font-semibold text-truncate">Calvin Carlo</Link>
                            <span className="text-slate-400 flex items-center text-sm"><span className="bg-green-600 text-white text-[10px] font-bold rounded-full size-2 me-1"></span> Online</span>
                        </div>
                    </div>

                    <div className="dropdown relative">
                        <button onClick={() => setManu(!manu)} className="dropdown-toggle items-center" type="button">
                            <span className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-[20px] text-center bg-gray-800/5 hover:bg-gray-800/10 dark:bg-gray-800 border border-gray-800/5 dark:border-gray-800 text-slate-900 dark:text-white rounded-full"><i className="mdi mdi-dots-vertical"></i></span>
                        </button>

                        <div className={`dropdown-menu absolute end-0 m-0 mt-4 z-10 w-44 rounded-md overflow-hidden bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 ${manu ? '' : 'hidden'}`}>
                            <ul className="py-2 text-start">
                                <li>
                                    <Link href="#" className="block font-medium py-1 px-4 text-slate-400 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"><i className="mdi mdi-account-outline"></i> Profile</Link>
                                </li>
                                <li>
                                    <Link href="#" className="block font-medium py-1 px-4 text-slate-400 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"><i className="mdi mdi-cog-outline"></i> Profile Settings</Link>
                                </li>
                                <li>
                                    <Link href="#" className="block font-medium py-1 px-4 text-slate-400 dark:text-white/70 hover:text-slate-900 dark:hover:text-white"><i className="mdi mdi-trash-can-outline"></i> Delete</Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <SimpleBarReact className="p-4 list-none mb-0 max-h-87.5 bg-no-repeat bg-center bg-cover" style={{backgroundImage:"url(/images/bg-chat.png)"}}>
                    <ul className="">
                        <li>
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative">
                                        <Image src='/images/client/01.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 start-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="ms-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Hey Cristina</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>59 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li className="text-end">
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative order-2">
                                        <Image src='/images/client/05.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 end-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="me-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Hello Calvin</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>45 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li className="text-end">
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative order-2">
                                        <Image src='/images/client/05.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 end-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="me-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">How can i help you?</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>44 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative">
                                        <Image src='/images/client/01.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 start-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="ms-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Nice to meet you</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>42 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative">
                                        <Image src='/images/client/01.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 start-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="ms-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Hope you are doing fine?</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>40 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li className="text-end">
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative order-2">
                                        <Image src='/images/client/05.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 end-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="me-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Im  good thanks for asking</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>38 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative">
                                        <Image src='/images/client/01.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 start-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="ms-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">I am intrested to know more about your prices and services you offer</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>35 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li className="text-end">
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative order-2">
                                        <Image src='/images/client/05.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 end-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="me-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Sure please check below link to find more useful information <Link href="https://shreethemes.in/techwind/" target="_blank" className="text-primary">https://shreethemes.in/techwind/</Link></p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>29 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative">
                                        <Image src='/images/client/01.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 start-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="ms-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Thank you 😊</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>26 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li className="text-end">
                            <div className="inline-block">
                                <div className="flex mb-3">
                                    <div className="relative order-2">
                                        <Image src='/images/client/05.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 end-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="me-2 max-w-lg">
                                        <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Welcome</p>
                                        <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>15 min ago</span>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="inline-block">
                                <div className="flex items-center mb-3">
                                    <div className="relative">
                                        <Image src='/images/client/01.jpg' height={36} width={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                        <span className="absolute top-0.5 start-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                    </div>
                                        
                                    <div className="ms-2 max-w-lg">
                                        <p className="text-slate-400 text-sm rounded mb-1">Frank Williams is typing
                                            <span className="animate-typing ms-1">
                                                <span className="dot inline-block size-1 bg-slate-400 -mr-px opacity-60 rounded-full"></span>
                                                <span className="dot inline-block size-1 bg-slate-400 -mr-px opacity-60 rounded-full"></span>
                                                <span className="dot inline-block size-1 bg-slate-400 -mr-px opacity-60 rounded-full"></span>
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </li>
                    </ul>
                </SimpleBarReact>
                

                <div className="p-2 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex ">
                        <input type="text" className="form-input w-full py-2 px-3 h-9 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-100 dark:border-gray-800 focus:ring-0" placeholder="Enter Message..."/>

                        <div className="min-w-31.25 text-end space-x-1">
                            <Link href="#" className="size-9 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-[16px] text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md"><i className="mdi mdi-send"></i></Link>
                            <Link href="#" className="size-9 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-[16px] text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md"><i className="mdi mdi-emoticon-happy-outline"></i></Link>
                            <Link href="#" className="size-9 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-[16px] text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md"><i className="mdi mdi-paperclip"></i></Link>
                        </div>
                    </div>
                </div>
            </div>
        </div> 
    )
}