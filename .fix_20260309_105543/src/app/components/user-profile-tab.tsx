'use client'
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from 'next/navigation'
import { AiOutlineCreditCard, AiOutlineDashboard } from "react-icons/ai";
import { TbNotebook } from "react-icons/tb";
import { FaRecycle } from "react-icons/fa";
import { LuBellRing } from "react-icons/lu";
import { BiCog } from "react-icons/bi";
import {CgLogOff} from 'react-icons/cg'

export default function UserProfileTab(){

    let pathname = usePathname()

    let [uploadFile , setUpoadFile] = useState('/images/client/05.jpg')
   
    function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
            if(event.target.files && event.target.files.length !== 0){
                setUpoadFile(URL.createObjectURL(event.target.files[0]))
        }
    }
    return(
        <>
        <div className="xl:col-span-3 lg:col-span-4 md:col-span-4 mx-6">
            <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900 -mt-48">
                <div className="profile-pic text-center mb-5">
                    <input id="pro-img" name="profile-image" type="file" className="hidden" onChange={(e) => handleChange(e)} />
                    <div>
                        <div className="relative size-24 mx-auto">
                            <Image src={uploadFile} width={96} height={96} placeholder="blur" blurDataURL={uploadFile} className="rounded-full shadow-sm dark:shadow-gray-700 ring-4 ring-slate-50 dark:ring-slate-800" id="profile-image" alt=""/>
                            <label className="absolute inset-0 cursor-pointer" htmlFor="pro-img"></label>
                        </div>

                        <div className="mt-4">
                            <h5 className="text-lg font-semibold">Cristina Murfy</h5>
                            <p className="text-slate-400">cristina@hotmail.com</p>
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700">
                    <ul className="list-none sidebar-nav mb-0 mt-3" id="navmenu-nav">
                        <li className="navbar-item account-menu">
                            <Link href="/profile" className={`${pathname === '/profile' ? 'text-primary dark:text-white' : 'text-slate-400'} navbar-link  flex items-center py-2 rounded hover:text-primary`}>
                                <span className="me-2 text-[18px] mb-0"><AiOutlineDashboard/></span>
                                <h6 className="mb-0 font-semibold">Profile</h6>
                            </Link>
                        </li>

                        <li className="navbar-item account-menu">
                            <Link href="/profile-billing" className={`${pathname === '/profile-billing' ? 'text-primary dark:text-white' : 'text-slate-400'} navbar-link  flex items-center py-2 rounded hover:text-primary`}>
                                <span className="me-2 text-[18px] mb-0"><TbNotebook/></span>
                                <h6 className="mb-0 font-semibold">Billing Info</h6>
                            </Link>
                        </li>

                        <li className="navbar-item account-menu">
                            <Link href="/profile-payment" className={`${pathname === '/profile-payment' ? 'text-primary dark:text-white' : 'text-slate-400'} navbar-link  flex items-center py-2 rounded hover:text-primary`}>
                                <span className="me-2 text-[18px] mb-0"><AiOutlineCreditCard/></span>
                                <h6 className="mb-0 font-semibold">Payment</h6>
                            </Link>
                        </li>

                        <li className="navbar-item account-menu">
                            <Link href="/profile-social" className={`${pathname === '/profile-social' ? 'text-primary dark:text-white' : 'text-slate-400'} navbar-link  flex items-center py-2 rounded hover:text-primary`}>
                                <span className="me-2 text-[18px] mb-0"><FaRecycle/></span>
                                <h6 className="mb-0 font-semibold">Social Profile</h6>
                            </Link>
                        </li>

                        <li className="navbar-item account-menu">
                            <Link href="/profile-notification" className={`${pathname === '/profile-notification' ? 'text-primary dark:text-white' : 'text-slate-400'} navbar-link  flex items-center py-2 rounded hover:text-primary`}>
                                <span className="me-2 text-[18px] mb-0"><LuBellRing/></span>
                                <h6 className="mb-0 font-semibold">Notifications</h6>
                            </Link>
                        </li>

                        <li className="navbar-item account-menu">
                            <Link href="/profile-setting" className={`${pathname === '/profile-setting' ? 'text-primary dark:text-white' : 'text-slate-400'} navbar-link  flex items-center py-2 rounded hover:text-primary`}>
                                <span className="me-2 text-[18px] mb-0"><BiCog/></span>
                                <h6 className="mb-0 font-semibold">Settings</h6>
                            </Link>
                        </li>

                        <li className="navbar-item account-menu">
                            <Link href="/auth-lock-screen" className={`${pathname === '/auth-lock-screen' ? 'text-primary dark:text-white' : 'text-slate-400'} navbar-link  flex items-center py-2 rounded hover:text-primary`}>
                                <span className="me-2 text-[18px] mb-0"><CgLogOff/></span>
                                <h6 className="mb-0 font-semibold">Sign Out</h6>
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
        </>
    )
}