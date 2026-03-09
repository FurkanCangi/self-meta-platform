"use client"
import React,{useState} from "react";
import Link from "next/link";
import Image from "next/image";

import * as Icon from 'react-feather'
import { reviewData } from "../data/data";

interface ReviewData{
    image: string;
    name: string;
    time: string;
    review: string;
}

export default function ProductDetailTab(){

    let [activeIndex, setActiveIndex] = useState(0)
    return(
    <div className="grid md:grid-cols-12 grid-cols-1 mt-6 gap-6">
        <div className="lg:col-span-3 md:col-span-5">
            <div className="sticky top-20">
                <ul className="flex-column p-6 bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md">
                    <li role="presentation">
                        <button onClick={() => setActiveIndex(0)} className={`px-4 py-2 text-start text-base font-semibold rounded-md w-full hover:text-primary duration-500 ${activeIndex === 0 ?'bg-primary text-white hover:text-white':''}`} >Description</button>
                    </li>
                    <li role="presentation">
                        <button onClick={() => setActiveIndex(1)} className={`px-4 py-2 text-start text-base font-semibold rounded-md w-full hover:text-primary duration-500 ${activeIndex === 1 ?'bg-primary text-white hover:text-white':''}`}>Additional Information</button>
                    </li>
                    <li role="presentation">
                        <button onClick={() => setActiveIndex(2)} className={`px-4 py-2 text-start text-base font-semibold rounded-md w-full hover:text-primary duration-500 ${activeIndex === 2 ?'bg-primary text-white hover:text-white':''}`}>Review</button>
                    </li>
                </ul>
            </div>
        </div>

        <div className="lg:col-span-9 md:col-span-7">
            <div id="myTabContent" className="p-6 bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md">
                {activeIndex === 0 ? 
                    <div>
                        <p className="text-slate-400">Due to its widespread use as filler text for layouts, non-readability is of great importance: human perception is tuned to recognize certain patterns and repetitions in texts. If the distribution of letters and words is random, the reader will not be distracted from making a neutral judgement on the visual impact and readability of the typefaces (typography), or the distribution of text on the page (layout or type area). For this reason, dummy text usually consists of a more or less random series of words or syllables.</p>
                    </div> : ''
                }
                {activeIndex === 1 ? 
                    <div>
                        <table className="w-full text-start">
                            <tbody>
                                <tr className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-gray-700">
                                    <td className="font-semibold py-4" style={{width:"100px"}}>Color</td>
                                    <td className="text-slate-400 py-4">Red, White, Black, Orange</td>
                                </tr>

                                <tr className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-gray-700">
                                    <td className="font-semibold py-4">Material</td>
                                    <td className="text-slate-400 py-4">Cotton</td>
                                </tr>

                                <tr className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-gray-700">
                                    <td className="font-semibold py-4">Size</td>
                                    <td className="text-slate-400 py-4">S, M, L, XL, XXL</td>
                                </tr>
                            </tbody>
                        </table>
                    </div> : ''
                }
                {activeIndex === 2 ? 
                    <div>
                        {reviewData.map((item:ReviewData,index:number) => {
                            return(
                                <div key={index}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <Image src={item.image} width={44} height={44} placeholder="blur" blurDataURL={item.image} className="size-11 rounded-full shadow" alt=""/>
        
                                            <div className="ms-3 flex-1">
                                                <Link href="" className="text-lg font-semibold hover:text-primary duration-500">{item.name}</Link>
                                                <p className="text-sm text-slate-400">{item.time}</p>
                                            </div>
                                        </div>
    
                                        <Link href="" className="text-slate-400 hover:text-primary duration-500 ms-5"><i className="mdi mdi-reply"></i> Reply</Link>
                                    </div>
                                    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-md shadow-sm dark:shadow-gray-700 mt-6 mb-6">
                                        <ul className="list-none inline-block text-orange-400">
                                            <li className="inline"><i className="mdi mdi-star text-lg"></i></li>
                                            <li className="inline"><i className="mdi mdi-star text-lg"></i></li>
                                            <li className="inline"><i className="mdi mdi-star text-lg"></i></li>
                                            <li className="inline"><i className="mdi mdi-star text-lg"></i></li>
                                            <li className="inline"><i className="mdi mdi-star text-lg"></i></li>
                                            <li className="inline text-slate-400 font-semibold">5.0</li>
                                        </ul>

                                        <p className="text-slate-400 italic">{item.review}</p>
                                    </div>
                                </div>
                            )
                        })}

                        <div className="p-6 rounded-md shadow-sm dark:shadow-gray-700 mt-8">
                            <h5 className="text-lg font-semibold">Leave A Comment:</h5>

                            <form className="mt-8">
                                <div className="grid lg:grid-cols-12 lg:gap-6">
                                    <div className="lg:col-span-6 mb-5">
                                        <div className="text-start">
                                            <label htmlFor="name" className="font-semibold">Your Name:</label>
                                            <div className="form-icon relative mt-2">
                                                <Icon.User className="size-4 absolute top-3 start-4"/>
                                                <input name="name" id="name" type="text" className="form-input ps-11 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Name :"/>
                                            </div>
                                        </div>
                                    </div>
    
                                    <div className="lg:col-span-6 mb-5">
                                        <div className="text-start">
                                            <label htmlFor="email" className="font-semibold">Your Email:</label>
                                            <div className="form-icon relative mt-2">
                                                <Icon.Mail className="size-4 absolute top-3 start-4"/>
                                                <input name="email" id="email" type="email" className="form-input ps-11 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Email :"/>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1">
                                    <div className="mb-5">
                                        <div className="text-start">
                                            <label htmlFor="comments" className="font-semibold">Your Comment:</label>
                                            <div className="form-icon relative mt-2">
                                                <Icon.MessageCircle className="size-4 absolute top-3 start-4"/>
                                                <textarea name="comments" id="comments" className="form-input ps-11 w-full py-2 px-3 h-28 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Message :"></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button className="py-2 px-5 inline-block tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md w-full">Send Message</button>
                            </form>
                        </div>

                    </div> 
                    
                    :''
                }
                           
            </div>
        </div>
    </div>
    )
}