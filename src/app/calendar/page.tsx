'use client'
import React from "react";
import Link from "next/link";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import CalendarItem from "../components/calendarItem";
import Wrapper from "../components/wrapper";
import { MdKeyboardArrowRight } from "react-icons/md";

export default function Page(){

    return(
    <Wrapper>
         <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <h5 className="text-lg font-semibold">Calendar</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Self Metacognition Institute</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Calendar</li>
                    </ul>
                </div>

                <div className="grid lg:grid-cols-12 grid-cols-1 mt-6 gap-2">
                    <div className="xl:col-span-2 lg:col-span-4">
                        <div id="external-events">
                            <div className="rounded-md shadow-sm dark:shadow-gray-700 p-6 bg-white dark:bg-slate-900">
                                <span className="h6 font-semibold">All Events</span>
                            
                                <div className="fc-event fc-h-event fc-daygrid-event fc-daygrid-block-event m-1 cursor-pointer bg-primary">
                                    <div className="fc-event-main py-1 px-2">Metting</div>
                                </div>
                                <div className="fc-event fc-h-event fc-daygrid-event fc-daygrid-block-event m-1 cursor-pointer bg-primary">
                                    <div className="fc-event-main py-1 px-2">Operations</div>
                                </div>
                                <div className="fc-event fc-h-event fc-daygrid-event fc-daygrid-block-event m-1 cursor-pointer bg-primary">
                                    <div className="fc-event-main py-1 px-2">Lunch</div>
                                </div>
                                <div className="fc-event fc-h-event fc-daygrid-event fc-daygrid-block-event m-1 cursor-pointer bg-primary">
                                    <div className="fc-event-main py-1 px-2">Conference</div>
                                </div>
                                <div className="fc-event fc-h-event fc-daygrid-event fc-daygrid-block-event m-1 cursor-pointer bg-primary">
                                    <div className="fc-event-main py-1 px-2">Business Metting</div>
                                </div>
                            
                                <div className="mt-2">
                                    <div className="flex items-center mb-0">
                                        <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" type="checkbox" value="" id="drop-remove"/>
                                        <label className="form-checkbox-label text-slate-400" htmlFor="drop-remove">Remove after drop</label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="xl:col-span-10 lg:col-span-8">
                        <CalendarItem/>
                    </div>
                </div>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
    )
}