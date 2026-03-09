"use client"
import React,{useEffect} from "react";
import Link from "next/link";

import dynamic from "next/dynamic";

const Analytics = dynamic(()=>import('../components/analytics'),{ssr:false})

import DataStates from "../components/data-states";
import Order from "../components/order";
import Chat from "../components/chat";
import TopProduct from "../components/top-product";
import Footer from "../components/footer";
import Switcher from "../components/switcher";

import Wrapper from "../components/wrapper";
import { BiExport } from "react-icons/bi";

export default function Page() {

    useEffect(() => {
        document.documentElement.setAttribute("dir", "rtl");
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
    }, []);

  return (
    <Wrapper>
        <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="flex justify-between items-center">
                    <div>
                        <h5 className="text-xl font-bold">Hello, Cristina</h5>
                        <h6 className="text-slate-400 font-semibold">Welcome!</h6>
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

                        <Link href="#" className="ms-1">
                            <span className="py-1.75 px-6 font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary/5 hover:bg-primary border-primary/10 hover:border-primary text-primary hover:text-white rounded-md sm:inline-block hidden"><BiExport className="inline"/> Export</span>

                            <span className="size-10 items-center justify-center tracking-wide align-middle duration-500 text-base text-center rounded-md border bg-primary/5 hover:bg-primary border-primary/10 hover:border-primary text-primary hover:text-white sm:hidden inline-flex"><BiExport/> </span>
                        </Link>
                    </div>
                </div>
                <DataStates/>
                <Analytics/>

                <div className="grid lg:grid-cols-12 grid-cols-1 mt-6 gap-6">
                    <Order/>
                    <Chat/>
                    <TopProduct/>
                </div>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
  )
}
