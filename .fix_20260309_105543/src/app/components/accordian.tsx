"use client"
import React,{useState, } from "react";
import Link from "next/link";

import { accordionData } from "../data/data";

import * as Icon from 'react-feather'
import { MdKeyboardArrowRight } from "react-icons/md";
import { AiOutlineClose } from "react-icons/ai";
import { IoIosArrowUp } from "react-icons/io";

interface AccordianData{
    title: string;
    contant: string;
}

export default function Accordion(){
    let [activeIndex, setActiveIndex] = useState<number>(0);
    let [activeIndex1, setActiveIndex1] = useState<number>(0);
    let [activeIndex2, setActiveIndex2] = useState<number>(0);
    let [activeIndex3, setActiveIndex3] = useState<number>(0);
    let [modal, setModal] = useState<boolean>(false)

    const toggleAccordion = (index:number) => {
        if (activeIndex === index) {
            setActiveIndex(0);
        } else {
            setActiveIndex(index);
        }
    }
    const toggleAccordion1 = (index:number) => {
        if (activeIndex1 === index) {
            setActiveIndex1(0);
        } else {
            setActiveIndex1(index);
        }
    }
    const toggleAccordion2 = (index:number) => {
        if (activeIndex2 === index) {
            setActiveIndex2(0);
        } else {
            setActiveIndex2(index);
        }
    }
    const toggleAccordion3 = (index:number) => {
        if (activeIndex3 === index) {
            setActiveIndex3(0);
        } else {
            setActiveIndex3(index);
        }
    }
    return(
        <>
        <div className="md:flex justify-between items-center">
            <div>
                <h5 className="text-lg font-semibold">Frequently Asked Questions</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center mt-2">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Self Metacognition Institute</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">FAQs</li>
                    </ul>
            </div>

            <div>
                <Link href="#" onClick={() => setModal(!modal)} className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-[20px] text-center bg-gray-800/5 hover:bg-gray-800/10 dark:bg-gray-700 border border-gray-800/5 dark:border-gray-800 text-slate-900 dark:text-white rounded-full" ><Icon.Plus className="size-4"/></Link>
            </div>

            <div className={`fixed z-999 flex items-center justify-center overflow-hidden inset-0 m-auto bg-gray-900/70 ${modal ? '': 'hidden'}`}>
                <div className="relative w-full h-auto max-w-lg p-4">
                    <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-sm dark:shadow-gray-700">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
                            <h5 className="text-xl font-semibold">Add new question</h5>
                            <button type="button" onClick={() => setModal(!modal)} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ms-auto inline-flex items-center dark:hover:bg-gray-800 dark:hover:text-white">
                                <AiOutlineClose className="size-5"/> 
                            </button>
                        </div>
                        <div className="p-4">                        
                            <form>
                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-12">
                                        <label className="font-semibold">Question <span className="text-red-600">*</span></label>
                                        <input name="name" id="name" type="text" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Title :"/>
                                    </div>

                                    <div className="col-span-12">
                                        <label className="font-semibold"> Answer </label>
                                        <textarea name="comments" id="comments" className="form-input w-full py-2 px-3 h-24 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Description :"></textarea>
                                    </div>

                                    <div className="col-span-12">
                                        <button type="submit" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md">Add Q&A</button>
                                    </div>
                                </div>
                            </form>
                        </div>                    
                    </div>
                </div>
            </div>
        </div>

        <div className="grid lg:grid-cols-2 grid-cols-1 mt-6 gap-6">
            <div className="rounded-md shadow-sm dark:shadow-gray-700 p-6 bg-white dark:bg-slate-900">
                <h5 className="font-semibold">Buying Product</h5>

                <div className="mt-3">
                    {accordionData.map((item:AccordianData,index:number)=>{
                        return(
                            <div key={index} className="relative shadow-sm dark:shadow-gray-700 rounded-md overflow-hidden mt-4 ">
                                <h2 className="text-base font-semibold" id="accordion-collapse-heading-1">
                                    <button onClick={() => toggleAccordion(index)} type="button" className={`flex justify-between items-center p-5 w-full font-medium text-start ${activeIndex === index ? 'bg-gray-50 dark:bg-slate-800 text-primary' : ''}`}>
                                        <span>{item.title}</span>
                                        <IoIosArrowUp className={`size-4  shrink-0 ${activeIndex === index ? "rotate-360" : "rotate-180"}`}/>
                                    </button>
                                </h2>
                                {activeIndex === index && (
                                    <div>
                                        <div className="p-5">
                                            <p className="text-slate-400 dark:text-gray-400">{item.contant}</p>
                                        </div>
                                    </div>
                                )}
                                
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="rounded-md shadow-sm dark:shadow-gray-700 p-6 bg-white dark:bg-slate-900">
                <h5 className="font-semibold">General Questions</h5>

                <div className="mt-3">
                    {accordionData.map((item:AccordianData,index:number)=>{
                        return(
                            <div key={index} className="relative shadow-sm dark:shadow-gray-700 rounded-md overflow-hidden mt-4 ">
                                <h2 className="text-base font-semibold" id="accordion-collapse-heading-1">
                                    <button onClick={() => toggleAccordion1(index)} type="button" className={`flex justify-between items-center p-5 w-full font-medium text-start ${activeIndex1 === index ? 'bg-gray-50 dark:bg-slate-800 text-primary' : ''}`}>
                                        <span>{item.title}</span>
                                        <IoIosArrowUp className={`size-4  shrink-0 ${activeIndex1 === index ? "rotate-360" : "rotate-180"}`}/>
                                    </button>
                                </h2>
                                {activeIndex1 === index && (
                                    <div>
                                        <div className="p-5">
                                            <p className="text-slate-400 dark:text-gray-400">{item.contant}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="rounded-md shadow-sm dark:shadow-gray-700 p-6 bg-white dark:bg-slate-900">
                <h5 className="font-semibold">Payments Questions</h5>

                <div className="mt-3">
                    {accordionData.map((item:AccordianData,index:number)=>{
                        return(
                            <div key={index} className="relative shadow-sm dark:shadow-gray-700 rounded-md overflow-hidden mt-4 ">
                                <h2 className="text-base font-semibold" id="accordion-collapse-heading-1">
                                    <button onClick={() => toggleAccordion2(index)} type="button" className={`flex justify-between items-center p-5 w-full font-medium text-start ${activeIndex2 === index ? 'bg-gray-50 dark:bg-slate-800 text-primary' : ''}`}>
                                        <span>{item.title}</span>
                                        <IoIosArrowUp className={`size-4  shrink-0 ${activeIndex2 === index ? "rotate-360" : "rotate-180"}`}/>
                                    </button>
                                </h2>
                                {activeIndex2 === index && (
                                    <div>
                                        <div className="p-5">
                                            <p className="text-slate-400 dark:text-gray-400">{item.contant}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="rounded-md shadow-sm dark:shadow-gray-700 p-6 bg-white dark:bg-slate-900">
                <h5 className="font-semibold">Support Questions</h5>

                <div className="mt-3">
                    {accordionData.map((item:AccordianData,index:number)=>{
                        return(
                            <div key={index} className="relative shadow-sm dark:shadow-gray-700 rounded-md overflow-hidden mt-4 ">
                                <h2 className="text-base font-semibold" id="accordion-collapse-heading-1">
                                    <button onClick={() => toggleAccordion3(index)} type="button" className={`flex justify-between items-center p-5 w-full font-medium text-start ${activeIndex3 === index ? 'bg-gray-50 dark:bg-slate-800 text-primary' : ''}`}>
                                        <span>{item.title}</span>
                                        <IoIosArrowUp className={`size-4  shrink-0 ${activeIndex3 === index ? "rotate-360" : "rotate-180"}`}/>
                                    </button>
                                </h2>
                                {activeIndex3 === index && (
                                    <div>
                                        <div className="p-5">
                                            <p className="text-slate-400 dark:text-gray-400">{item.contant}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
        </>
    )
}