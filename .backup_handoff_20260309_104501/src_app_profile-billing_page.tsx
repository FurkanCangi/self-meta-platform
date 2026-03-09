import React from "react";
import Image from "next/image";
import Link from "next/link";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import UserProfileTab from "../components/user-profile-tab";
import Wrapper from "../components/wrapper";
import { FaRegEdit } from "react-icons/fa";
import { FiMapPin, FiPhone } from "react-icons/fi";

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
                            <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <h6 className="text-slate-400 mb-0">The following addresses will be used on the checkout page by default.</h6>
                                <div className="md:flex mt-6">
                                    <div className="md:w-1/2 md:px-3">
                                        <div className="flex items-center mb-4 justify-between">
                                            <h5 className="text-xl font-semibold">Billing Address:</h5>
                                            <Link href="#" className="text-primary text-lg"><FaRegEdit/></Link>
                                        </div>
                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                            <p className="text-lg font-semibold mb-2">Cristina Murfy</p>

                                            <ul className="list-none">
                                                <li className="flex">
                                                    <FiMapPin className="me-2 mt-1"/>
                                                    <p className="text-slate-400">C/54 Northwest Freeway, Suite 558, <br/> Houston, USA 485</p>
                                                </li>

                                                <li className="flex mt-1">
                                                     <FiPhone className="me-2 mt-1"/>
                                                    <p className="text-slate-400">+123 897 5468</p>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                    
                                    <div className="md:w-1/2 md:px-3 m-7.5 md:mt-0">
                                        <div className="flex items-center mb-4 justify-between">
                                            <h5 className="text-xl font-semibold">Shipping Address:</h5>
                                            <Link href="#" className="text-primary text-lg"><FaRegEdit className="me-"/></Link>
                                        </div>
                                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                            <p className="text-lg font-semibold mb-2">Cristina Murfy</p>

                                            <ul className="list-none">
                                                <li className="flex">
                                                    <FiMapPin className="me-2 mt-1"/>
                                                    <p className="text-slate-400">C/54 Northwest Freeway, Suite 558, <br/> Houston, USA 485</p>
                                                </li>

                                                <li className="flex mt-1">
                                                    <FiPhone className="me-2 mt-1"/>
                                                    <p className="text-slate-400">+123 897 5468</p>
                                                </li>
                                            </ul>
                                        </div>
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