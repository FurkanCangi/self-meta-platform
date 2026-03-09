"use client"
import React,{ useState }  from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

const Editer = dynamic(()=>import('./editer'),{ssr:false})

import { inboxData } from "../data/data";
import { BiPlus } from "react-icons/bi";
import { AiOutlineClose, AiOutlineDelete, AiOutlineInbox } from "react-icons/ai";
import {TbMailStar, TbMailUp, } from 'react-icons/tb'
import {RiMailSendLine} from 'react-icons/ri'
import { LuMailPlus } from "react-icons/lu";
import { MdOutlineEventNote } from "react-icons/md";

export default function Mail(){
    let [composeModal, setComposeModal] = useState(false)
    let [activeIndex, setActiveIndex] = useState(0);
    return(
        <div className="grid md:grid-cols-12 grid-cols-1 mt-6 gap-2">
            <div className="xl:col-span-2 lg:col-span-3 md:col-span-4">
                <div className="rounded-md shadow-sm dark:shadow-gray-700 p-6 bg-white dark:bg-slate-900">
                    <Link href=""  onClick={() => setComposeModal(!composeModal)} className="py-2 px-5 inline-flex items-center justify-center font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md w-full"><BiPlus className="me-1"/> Compose</Link>
                    <ul className="flex-column mt-3">
                        <li role="presentation">
                            <button onClick={() => setActiveIndex(0)}  className={`${activeIndex === 0 ? 'bg-primary  text-white' : 'text-base hover:text-primary'}  px-4 py-2  font-semibold rounded-md w-full  duration-500 text-start flex items-center`}><AiOutlineInbox className="me-1"/> Inbox</button>
                        </li>
                        <li role="presentation">
                            <button onClick={() => setActiveIndex(1)}   className={`${activeIndex === 1 ? 'bg-primary  text-white' : 'text-base hover:text-primary'}  px-4 py-2  font-semibold rounded-md w-full  duration-500 text-start flex items-center`} ><TbMailStar className="me-1"/> Starred</button>
                        </li>
                        <li role="presentation">
                            <button onClick={() => setActiveIndex(2)}   className={`${activeIndex === 2 ? 'bg-primary  text-white' : 'text-base hover:text-primary'}  px-4 py-2  font-semibold rounded-md w-full  duration-500 text-start flex items-center`} ><RiMailSendLine className="me-1"/> Spam</button>
                        </li>
                        <li role="presentation">
                            <button onClick={() => setActiveIndex(3)}   className={`${activeIndex === 3 ? 'bg-primary  text-white' : 'text-base hover:text-primary'}  px-4 py-2  font-semibold rounded-md w-full  duration-500 text-start flex items-center`} ><TbMailUp className="me-1"/> Sent</button>
                        </li>
                        <li role="presentation">
                            <button onClick={() => setActiveIndex(4)}   className={`${activeIndex === 4 ? 'bg-primary  text-white' : 'text-base hover:text-primary'}  px-4 py-2  font-semibold rounded-md w-full  duration-500 text-start flex items-center`} ><LuMailPlus className="me-1"/> Drafts</button>
                        </li>
                        <li role="presentation">
                            <button onClick={() => setActiveIndex(5)}   className={`${activeIndex === 5 ? 'bg-primary  text-white' : 'text-base hover:text-primary'}  px-4 py-2  font-semibold rounded-md w-full  duration-500 text-start flex items-center`} ><AiOutlineDelete className="me-1"/> Delete</button>
                        </li>
                        <li role="presentation">
                            <button onClick={() => setActiveIndex(6)}   className={`${activeIndex === 6 ? 'bg-primary  text-white' : 'text-base hover:text-primary'}  px-4 py-2  font-semibold rounded-md w-full  duration-500 text-start flex items-center`} ><MdOutlineEventNote className="me-1"/> Notes</button>
                        </li>
                    </ul>
                </div>
            </div>
            

            <div className={`fixed z-50 flex items-center justify-center overflow-hidden inset-0 m-auto bg-gray-900/50 dark:opacity-80 ${composeModal ? '' : 'hidden'}`}>
                <div className="relative w-full h-auto max-w-xl p-4">
                    <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-sm dark:shadow-gray-700">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                            <h5 className="text-xl font-semibold">Compose</h5>
                            <button type="button" onClick={() => setComposeModal(!composeModal)} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ms-auto inline-flex items-center dark:hover:bg-gray-800 dark:hover:text-white">
                                <AiOutlineClose/> 
                            </button>
                        </div>
                        <div className="p-6 text-center">
                            <form>
                                <div className="grid md:grid-cols-12 grid-cols-1 gap-4">
                                    <div className="md:col-span-12">
                                        <div className="form-icon relative">
                                            <input name="email" id="toemail" type="email" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="To"/>
                                        </div>
                                    </div>

                                    <div className="md:col-span-6">
                                        <div className="form-icon relative">
                                            <input name="email" id="ccemail" type="email" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Cc"/>
                                        </div>
                                    </div>

                                    <div className="md:col-span-6">
                                        <div className="form-icon relative">
                                            <input name="email" id="bccemail" type="email" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Bcc"/>
                                        </div>
                                    </div>

                                    <div className="md:col-span-12">
                                        <Editer/>
                                    </div>

                                    <div className="md:col-span-12">
                                        <button type="submit" id="submit" name="send" className="py-2 px-5 font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md justify-center flex items-center">Send Now</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>


            <div className="xl:col-span-10 lg:col-span-9 md:col-span-8">
                <div id="myTabContent" className="">
                    {activeIndex === 0 ? 
                        <div>
                            <div className="relative overflow-x-auto block w-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md">
                                <table className="w-full text-start">
                                    <thead className="text-base">
                                        <tr>
                                            <th className="text-start p-4 w-10 min-w-7.5 max-w-7.5">
                                                <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="allcheck"/>
                                            </th>
                                            <th className="text-center p-4 w-10 min-w-7.5 max-w-7.5"></th>
                                            <th className="text-start p-4 w-48 min-w-50">Name</th>
                                            <th className="text-start p-4 w-auto min-w-75">Subject</th>
                                            <th className="text-end p-4 w-48 min-w-50">Date & Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {inboxData.map((item, index)=>{
                                            return(
                                                <tr key={index}>
                                                    <th className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                                        <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="firstcheck"/>
                                                    </th>
                                                    <td className="text-center border-t border-gray-100 dark:border-gray-800 p-4">
                                                        <Link href=""><i className={` text-[18px]  align-middle ${item.star === true ? 'text-yellow-500 mdi mdi-star' : 'text-slate-400 mdi mdi-star-outline'}`}></i></Link>
                                                    </td>
                                                    <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                                        <Link href="#" className="font-semibold hover:text-primary">{item.name}</Link>
                                                    </td>
                                                    <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                                        <span className="text-slate-400">{item.subject}</span>
                                                    </td>
                                                    <td className="text-end border-t border-gray-100 dark:border-gray-800 p-4">
                                                        <span className="text-slate-400">{item.time}</span>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 flex items-center justify-between">
                                <div>
                                    <Link href="#" className="size-8 inline-flex items-center justify-center font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 border-gray-100 dark:border-gray-700 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full"><i className="mdi mdi-arrow-left"></i></Link>
                                    <Link href="#" className="size-8 inline-flex items-center justify-center font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 border-gray-100 dark:border-gray-700 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full"><i className="mdi mdi-arrow-right"></i></Link>
                                </div>

                                <span className="text-slate-400">Showing 1 - 10 out of 45</span>
                            </div>
                        </div> : ''
                    }
                    {activeIndex === 1 ? 
                    <div >
                        <div className="relative overflow-x-auto block w-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md">
                            <table className="w-full text-start">
                                <thead className="text-base">
                                    <tr>
                                        <th className="text-start p-4 w-10 min-w-7.5 max-w-7.5">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="allcheck"/>
                                        </th>
                                        <th className="text-center p-4 w-10 min-w-7.5 max-w-7.5"></th>
                                        <th className="text-start p-4 w-48 min-w-50">Name</th>
                                        <th className="text-start p-4 w-auto min-w-50">Subject</th>
                                        <th className="text-end p-4 w-48 min-w-50">Date & Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <th className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="firstcheck"/>
                                        </th>
                                        <td className="text-center border-t border-gray-100 dark:border-gray-800 p-4">
                                            <Link href=""><i className="mdi mdi-star text-[18px] text-yellow-500 align-middle"></i></Link>
                                        </td>
                                        <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <Link href="#" className="font-semibold hover:text-primary" data-modal-toggle="emailpreview">Sherrie Miller</Link>
                                        </td>
                                        <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <span className="text-slate-400">Focused impactful open system 📷 😃</span>
                                        </td>
                                        <td className="text-end border-t border-gray-100 dark:border-gray-800 p-4">
                                            <span className="text-slate-400">8hours ago</span>
                                        </td>
                                    </tr>

                                    <tr>
                                        <th className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="firstcheck"/>
                                        </th>
                                        <td className="text-center border-t border-gray-100 dark:border-gray-800 p-4">
                                            <Link href=""><i className="mdi mdi-star text-[18px] text-yellow-500 align-middle"></i></Link>
                                        </td>
                                        <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <Link href="#" className="font-semibold hover:text-primary" data-modal-toggle="emailpreview">Ester Casella</Link>
                                        </td>
                                        <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <span className="text-slate-400">Theme Update</span>
                                        </td>
                                        <td className="text-end border-t border-gray-100 dark:border-gray-800 p-4">
                                            <span className="text-slate-400">7th August 2023</span>
                                        </td>
                                    </tr>
                                    
                                    <tr>
                                        <th className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="firstcheck"/>
                                        </th>
                                        <td className="text-center border-t border-gray-100 dark:border-gray-800 p-4">
                                            <Link href=""><i className="mdi mdi-star text-[18px] text-yellow-500 align-middle"></i></Link>
                                        </td>
                                        <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <Link href="#" className="font-semibold hover:text-primary" data-modal-toggle="emailpreview">Richard Benavides</Link>
                                        </td>
                                        <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                            <span className="text-slate-400">Your product has been updated!</span>
                                        </td>
                                        <td className="text-end border-t border-gray-100 dark:border-gray-800 p-4">
                                            <span className="text-slate-400">5th August 2023</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>: ''
                    }

                    {activeIndex === 2 ? 
                        <div>
                            <div className="relative overflow-x-auto block w-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md p-6">
                                <span className="text-slate-400">Hooray, no spam here!</span>
                            </div>
                        </div> :''
                    }

                    {activeIndex === 3 ? 
                        <div >
                            <div className="relative overflow-x-auto block w-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md">
                                <table className="w-full text-start">
                                    <thead className="text-base">
                                        <tr>
                                            <th className="text-start p-4 w-10 min-w-7.5 max-w-7.5">
                                                <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="allcheck"/>
                                            </th>
                                            <th className="text-center p-4 w-10 min-w-7.5 max-w-7.5"></th>
                                            <th className="text-start p-4 w-48 min-w-50">Name</th>
                                            <th className="text-start p-4 w-auto min-w-50">Subject</th>
                                            <th className="text-end p-4 w-48 min-w-50">Date & Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                                <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50" type="checkbox" value="" id="firstcheck"/>
                                            </th>
                                            <td className="text-center border-t border-gray-100 dark:border-gray-800 p-4">
                                                <Link href=""><i className="mdi mdi-star-outline text-[18px] text-slate-400 align-middle"></i></Link>
                                            </td>
                                            <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                                <Link href="#" className="font-semibold hover:text-primary" data-modal-toggle="emailpreview">Calvin Carlo</Link>
                                            </td>
                                            <td className="text-start border-t border-gray-100 dark:border-gray-800 p-4">
                                                <span className="text-slate-400">Self Metacognition Institute Customization</span>
                                            </td>
                                            <td className="text-end border-t border-gray-100 dark:border-gray-800 p-4">
                                                <span className="text-slate-400">03:05PM</span>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div> :''
                    }
                    {activeIndex === 4 ? 
                        <div>
                            <div className="relative overflow-x-auto block w-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md p-6">
                                <span className="text-slate-400">You dont have any saved drafts. Saving a draft allows you to keep a message you arent ready to send yet.</span>
                            </div>
                        </div> : ''
                    }
                    {activeIndex === 5 ? 
                        <div>
                            <div className="relative overflow-x-auto block w-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md p-6">
                                <span className="text-slate-400">No conversations in Trash.</span>
                            </div>
                        </div> :''
                    }
                    {activeIndex === 6 ? 
                        <div className="hidden " id="note" role="tabpanel" aria-labelledby="note-tab">
                            <div className="relative overflow-x-auto block w-full bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md p-6">
                                <span className="text-slate-400">No notes in Notes</span>
                            </div>
                        </div> : ''
                    }
                </div>
            </div>
        </div>
    )
}