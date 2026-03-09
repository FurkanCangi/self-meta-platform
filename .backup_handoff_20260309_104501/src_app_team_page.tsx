import React from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";

import * as Icon from 'react-feather'
import { teamData } from "../data/data";
import { MdKeyboardArrowRight } from "react-icons/md";

interface TeamData{
    image: string;
    name: string;
    title: string;
}

export default function Page() {
 
  return (
    <Wrapper>
        <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <h5 className="text-lg font-semibold">Team Members</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Techwind</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Team</li>
                    </ul>
                </div>

                <div className="grid xl:grid-cols-6 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 mt-6 gap-6">
                    {teamData.map((item:TeamData,index:number) => {
                        return(
                            <div className="group text-center" key={index}>
                                <div className="relative inline-block mx-auto max-h-52 max-w-52 rounded-full overflow-hidden shadow-sm dark:shadow-gray-700">
                                    <Image src={item.image} width={0} height={0} sizes="100vw" placeholder="blur" blurDataURL={item.image} style={{width:'100%', height:'auto'}} className="" alt=""/>
                                    <div className="absolute inset-0 bg-linear-to-b from-transparent to-black max-h-52 max-w-52 rounded-full opacity-0 group-hover:opacity-100 duration-500"></div>

                                    <ul className="list-none absolute start-0 end-0 -bottom-20 group-hover:bottom-5 duration-500 space-x-1">
                                        <li className="inline"><Link href="#" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center rounded-full border border-primary bg-primary hover:border-primary hover:bg-primary text-white"><Icon.Facebook className="size-4"/></Link></li>
                                        <li className="inline"><Link href="#" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center rounded-full border border-primary bg-primary hover:border-primary hover:bg-primary text-white"><Icon.Instagram className="size-4"/></Link></li>
                                        <li className="inline"><Link href="#" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center rounded-full border border-primary bg-primary hover:border-primary hover:bg-primary text-white"><Icon.Linkedin className="size-4"/></Link></li>
                                    </ul>
                                </div>

                                <div className="content mt-3">
                                    <Link href="" className="text-lg font-semibold hover:text-primary duration-500">{item.name}</Link>
                                    <p className="text-slate-400">{item.title}</p>
                                </div>
                            </div>
                        )
                    })}
                    
                </div>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
  )
}
