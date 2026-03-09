"use client"
import React,{useState} from "react";

import { accordionData } from "../data/data";
import { IoIosArrowUp } from "react-icons/io";

interface AccordianData{
    title: string;
    contant: string;
}

export default function AccordianTwo(){
    let [activeIndex, setActiveIndex] = useState<number>(0);

    let toggleAccordion = (index:number) => {
        if (activeIndex === index) {
            setActiveIndex(0);
        } else {
            setActiveIndex(index);
        }
    }
    return(
        <div className="mt-6">
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
    )
}