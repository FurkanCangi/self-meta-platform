import React from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Simplebar from "../components/simplebar";
import Wrapper from "../components/wrapper";
import ChatDropdown from "../components/chat-dropdown";

import { userData } from "../data/data";
import { MdKeyboardArrowRight } from "react-icons/md";

interface UserData{
    image: string;
    name: string;
    lastSeen: string;
    active: boolean;
    msg: string;
}

export default function Page(){
    return(
    <Wrapper>
        <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <h5 className="text-lg font-semibold">Chatbox</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Self Metacognition Institute</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Chatbox</li>
                    </ul>
                </div>

                <div className="grid md:grid-cols-12 grid-cols-1 mt-6 gap-2">
                    <div className="xl:col-span-3 lg:col-span-5 md:col-span-5">
                        <div className="rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="text-center p-6 border-b border-gray-100 dark:border-gray-800">
                                <Image src='/images/client/05.jpg' width={80} height={80} placeholder="blur" blurDataURL="/images/client/05.jpg" className="size-20 rounded-full shadow-sm dark:shadow-gray-700 mx-auto" alt=""/>
                                <h5 className="mt-3 font-semibold text-xl mb-0">Cristina Julia</h5>
                                <p className="text-slate-400 mb-0">UI / UX Designer</p>
                            </div>
                            <Simplebar className="p-2 max-h-125">
                                {userData.map((item:UserData, index:number) => {
                                    return(
                                        <Link href="#" className="flex items-center p-2 rounded-md relative first:bg-gray-50 first:dark:bg-slate-800  hover:bg-gray-50 dark:hover:bg-slate-800" key={index}>
                                        <div className="relative">
                                            <Image src={item.image} width={44} height={44} placeholder="blur" blurDataURL={item.image} className="size-11 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                            {item.active === true ?  <span className="absolute top-0.5 start-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span> :
                                            <span className="absolute top-0.5 start-0.5 flex items-center justify-center bg-red-600 text-white text-[10px] font-bold rounded-full size-2"></span>
                                            }
                                           
                                        </div>
                                        <div className="overflow-hidden flex-1 ms-2">
                                            <div className="flex justify-between">
                                                <h6 className="font-semibold">{item.name}</h6>
                                                <small className="text-slate-400">{item.lastSeen}</small>
                                            </div>
                                            <div className="text-slate-400 truncate">{item.msg}</div>
                                        </div>
                                    </Link>
                                    )
                                })}
                            </Simplebar>
                        </div>
                    </div>

                    <div className="xl:col-span-9 lg:col-span-7 md:col-span-7">
                        <div className="rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-800 p-4">
                                <div className="flex">
                                    <Image src='/images/client/12.jpg' width={44} height={44} placeholder="blur" blurDataURL="/images/client/12.jpg" className="size-11 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                    <div className="overflow-hidden ms-3">
                                        <Link href="#" className="block font-semibold text-truncate">Calvin Carlo</Link>
                                        <span className="text-slate-400 flex items-center text-sm"><span className="bg-green-600 text-white text-[10px] font-bold rounded-full size-2 me-1"></span> Online</span>
                                    </div>
                                </div>

                                <ChatDropdown/>
                            </div>
                            <Simplebar className="p-4 list-none mb-0 max-h-141.25 bg-no-repeat bg-center bg-cover" style={{backgroundImage:'url("/images/bg-chat.png")'}}>
                                <ul>
                                    <li>
                                        <div className="inline-block">
                                            <div className="flex mb-3">
                                                <div className="relative">
                                                    <Image src='/images/client/01.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/05.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/05.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/01.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/01.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/05.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
                                                    <span className="absolute top-0.5 end-0.5 flex items-center justify-center bg-green-600 text-white text-[10px] font-bold rounded-full size-2 after:content-[''] after:absolute after:size-2 after:bg-green-600 after:top-0 after:end-0 after:rounded-full after:animate-ping"></span>
                                                </div>
                                                    
                                                <div className="me-2 max-w-lg">
                                                    <p className="bg-white dark:bg-slate-900 text-slate-400 text-sm shadow-sm dark:shadow-gray-700 px-3 py-2 rounded mb-1">Im good thanks for asking</p>
                                                    <span className="text-slate-400 text-sm"><i className="mdi mdi-clock-outline me-1"></i>38 min ago</span>
                                                </div>
                                            </div>
                                        </div>
                                    </li>

                                    <li>
                                        <div className="inline-block">
                                            <div className="flex mb-3">
                                                <div className="relative">
                                                    <Image src='/images/client/01.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/01.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/01.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/05.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                                                    <Image src='/images/client/01.jpg' width={36} height={36} className="size-9 min-w-9 rounded-full shadow-sm dark:shadow-gray-700" alt=""/>
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
                            </Simplebar>

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
                </div>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
    )
}