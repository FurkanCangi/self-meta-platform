import React from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import UserProfileTab from "../components/user-profile-tab";
import Wrapper from "../components/wrapper";
import Portfolio from "../components/portfolio";

import * as Icon from 'react-feather'
import { experienceData } from "../data/data";

interface ExperienceData{
    image: string;
    title: string;
    experience: string;
    company: string;
    location: string;
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
                            <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <h5 className="text-xl font-semibold">Cristina Murfy</h5>
                    
                                <p className="text-slate-400 mt-3">I have started my career as a trainee and prove my self and achieve all the milestone with good guidance and reach up to the project manager. In this journey, I understand all the procedure which make me a good developer, team leader, and a project manager.</p>
                            </div>

                            <div className="grid lg:grid-cols-2 grid-cols-1 gap-6">
                                <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900 h-fit">
                                    <h5 className="text-xl font-semibold">Personal Details :</h5>
                                    <div className="mt-6">
                                        <div className="flex items-center">
                                            <Icon.Mail className="fea icon-ex-md text-slate-400 me-3"/>
                                            <div className="flex-1">
                                                <h6 className="text-primary dark:text-white font-medium mb-0">Email :</h6>
                                                <Link href="" className="text-slate-400">cristina@hotmail.com</Link>
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-3">
                                            <Icon.Bookmark className="fea icon-ex-md text-slate-400 me-3"/>
                                            <div className="flex-1">
                                                <h6 className="text-primary dark:text-white font-medium mb-0">Skills :</h6>
                                                <Link href="" className="text-slate-400">html</Link>, <Link href="" className="text-slate-400">css</Link>, <Link href="" className="text-slate-400">js</Link>, <Link href="" className="text-slate-400">mysql</Link>
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-3">
                                            <Icon.Italic className="fea icon-ex-md text-slate-400 me-3"/>
                                            <div className="flex-1">
                                                <h6 className="text-primary dark:text-white font-medium mb-0">Language :</h6>
                                                <Link href="" className="text-slate-400">English</Link>, <Link href="" className="text-slate-400">Japanese</Link>, <Link href="" className="text-slate-400">Chinese</Link>
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-3">
                                            <Icon.Globe className="fea icon-ex-md text-slate-400 me-3"/>
                                            <div className="flex-1">
                                                <h6 className="text-primary dark:text-white font-medium mb-0">Website :</h6>
                                                <Link href="" className="text-slate-400">www.cristina.com</Link>
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-3">
                                            <Icon.Gift className="fea icon-ex-md text-slate-400 me-3"/>
                                            <div className="flex-1">
                                                <h6 className="text-primary dark:text-white font-medium mb-0">Birthday :</h6>
                                                <p className="text-slate-400 mb-0">2nd March, 1996</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-3">
                                            <Icon.MapPin className="fea icon-ex-md text-slate-400 me-3"/>
                                            <div className="flex-1">
                                                <h6 className="text-primary dark:text-white font-medium mb-0">Location :</h6>
                                                <Link href="" className="text-slate-400">Beijing, China</Link>
                                            </div>
                                        </div>
                                        <div className="flex items-center mt-3">
                                            <Icon.Phone className="fea icon-ex-md text-slate-400 me-3"/>
                                            <div className="flex-1">
                                                <h6 className="text-primary dark:text-white font-medium mb-0">Cell No :</h6>
                                                <Link href="" className="text-slate-400">(+12) 1254-56-4896</Link>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900 h-fit">
                                    <h5 className="text-xl font-semibold">Experience :</h5>
                                    {experienceData.map((item:ExperienceData, index:number) =>{
                                        return(
                                            <div key={index} className="flex duration-500 hover:scale-105 shadow-sm dark:shadow-gray-700 hover:shadow-md dark:hover:shadow-gray-700 ease-in-out items-center p-4 rounded-md bg-white dark:bg-slate-900 mt-6">
                                                <Image src={item.image} width={64} height={64} placeholder="blur" blurDataURL={item.image} className="h-16 w-16 p-4 bg-slate-50 dark:bg-slate-800 shadow-sm dark:shadow-gray-700 rounded-md" alt=""/>
                                                <div className="flex-1 content ms-4">
                                                    <h4 className="text-lg text-medium">{item.title}</h4>
                                                    <p className="text-slate-400 mb-0">{item.experience}</p>
                                                    <p className="text-slate-400 mb-0"><Link href="" className="text-primary">{item.company}</Link> {item.location}</p>    
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="p-6 relative rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                                <h5 className="text-xl font-semibold">Portfolio :</h5>
                                <Portfolio/>
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