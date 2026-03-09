"use client"
import React from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";

import * as Icon from 'react-feather'

import { blogComments, recentPost } from "../data/data";
import { MdKeyboardArrowRight } from "react-icons/md";

interface Comments{
    image: string;
    name: string;
    time: string;
    comment: string;
}

interface RecentPost{
    image: string;
    title: string;
    time: string;
}

export default function Page() {

  return (
    <Wrapper>
        <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <h5 className="text-lg font-semibold">My Very Minimal Interior Design Ideas</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Techwind</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Blog Detail</li>
                    </ul>
                </div>

                <div className="grid md:grid-cols-12 grid-cols-1 mt-6 gap-6">
                    <div className="lg:col-span-8 md:col-span-6">
                        <div className="p-6 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">

                            <Image src='/images/blog/bg.jpg' width={0} height={0} sizes="100vw" placeholder="blur" blurDataURL="/images/blog/bg.jpg" style={{width:'100%', height:'auto'}} className="rounded-md" alt=""/>

                            <div className="mt-6">
                                <p className="text-slate-400">The most well-known dummy text is the Lorem Ipsum , which is said to have originated in the 16th century. Lorem Ipsum is composed in a pseudo-Latin language which more or less corresponds to proper Latin. It contains a series of real Latin words. This ancient dummy text is also incomprehensible, but it imitates the rhythm of most European languages in Latin script.</p>
                                <p className="text-slate-400 italic border-x-4 border-primary rounded-ss-xl rounded-ee-xl mt-3 p-3"> There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which dont look even slightly believable. </p>
                                <p className="text-slate-400 mt-3">The advantage of its Latin origin and the relative meaninglessness of Lorum Ipsum is that the text does not attract attention to itself or distract the viewers attention from the layout.</p>
                            </div>
                        </div>

                        <div className="p-6 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900 mt-6">
                            <h5 className="text-lg font-semibold">Comments:</h5>
                            {blogComments.map((item:Comments, index:number)=>{
                                return(
                                    <div className="mt-6" key={index}>
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
                                        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-md shadow-sm dark:shadow-gray-700 mt-6">
                                            <p className="text-slate-400 italic">{item.comment}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="p-6 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900 mt-6">
                            <h5 className="text-lg font-semibold">Leave A Comment:</h5>

                            <form className="mt-6">
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
                                <button type="submit" id="submit" name="send" className="py-2 px-5 inline-block tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md w-full">Send Message</button>
                            </form>
                        </div>
                    </div>

                    <div className="lg:col-span-4 md:col-span-6">
                        <div className="p-6 rounded-md shadow-sm dark:shadow-gray-700 bg-white dark:bg-slate-900">
                            <h5 className="text-lg font-semibold bg-gray-50 dark:bg-slate-800 shadow-sm dark:shadow-gray-700 rounded-md p-2 text-center">Author</h5>
                            <div className="text-center mt-6">
                                <Image src='/images/client/05.jpg' width={96} height={96} placeholder="blur" blurDataURL="/images/client/05.jpg" className="size-24 mx-auto rounded-full shadow-sm mb-4" alt=""/>

                                <Link href="" className="text-lg font-semibold hover:text-primary duration-500">Cristina Romsey</Link>
                                <p className="text-slate-400">Content Writer</p>
                            </div>

                            <h5 className="text-lg font-semibold bg-gray-50 dark:bg-slate-800 shadow-sm dark:shadow-gray-700 rounded-md p-2 text-center mt-6">Recent post</h5>
                            {recentPost.map((item:RecentPost, index:number) => {
                                return(
                                    <div className="flex items-center mt-6" key={index}>
                                        <Image src={item.image} width={96} height={64} placeholder="blur" blurDataURL={item.image} className="h-16 rounded-md shadow-sm dark:shadow-gray-700" alt=""/>

                                        <div className="ms-3">
                                            <Link href="" className="font-semibold hover:text-primary">{item.title}</Link>
                                            <p className="text-sm text-slate-400">{item.time}</p>
                                        </div>
                                    </div>
                                )
                            })}
                            <h5 className="text-lg font-semibold bg-gray-50 dark:bg-slate-800 shadow-sm dark:shadow-gray-700 rounded-md p-2 text-center mt-6">Social sites</h5>
                            <ul className="list-none text-center mt-6 space-x-1">
                                <li className="inline"><Link href="" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center border border-gray-100 dark:border-gray-800 rounded-md text-slate-400 hover:border-primary hover:text-white hover:bg-primary"><Icon.Facebook className="size-4"/></Link></li>
                                <li className="inline"><Link href="" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center border border-gray-100 dark:border-gray-800 rounded-md text-slate-400 hover:border-primary hover:text-white hover:bg-primary"><Icon.Instagram className="size-4"/></Link></li>
                                <li className="inline"><Link href="" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center border border-gray-100 dark:border-gray-800 rounded-md text-slate-400 hover:border-primary hover:text-white hover:bg-primary"><Icon.Twitter className="size-4"/></Link></li>
                                <li className="inline"><Link href="" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center border border-gray-100 dark:border-gray-800 rounded-md text-slate-400 hover:border-primary hover:text-white hover:bg-primary"><Icon.Linkedin className="size-4"/></Link></li>
                                <li className="inline"><Link href="" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center border border-gray-100 dark:border-gray-800 rounded-md text-slate-400 hover:border-primary hover:text-white hover:bg-primary"><Icon.GitHub className="size-4"/></Link></li>
                                <li className="inline"><Link href="" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center border border-gray-100 dark:border-gray-800 rounded-md text-slate-400 hover:border-primary hover:text-white hover:bg-primary"><Icon.Youtube className="size-4"/></Link></li>
                                <li className="inline"><Link href="" className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-base text-center border border-gray-100 dark:border-gray-800 rounded-md text-slate-400 hover:border-primary hover:text-white hover:bg-primary"><Icon.Gitlab className="size-4"/></Link></li>
                            </ul>

                            <h5 className="text-lg font-semibold bg-gray-50 dark:bg-slate-800 shadow-sm dark:shadow-gray-700 rounded-md p-2 text-center mt-6">Tagscloud</h5>
                            <ul className="list-none text-center mt-6 space-x-2">
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Business</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Finance</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Marketing</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Fashion</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Bride</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Lifestyle</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Travel</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Beauty</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Video</Link></li>
                                <li className="inline-block my-2"><Link href="" className="px-3 py-1 text-slate-400 hover:text-white dark:hover:text-white bg-gray-50 dark:bg-slate-800 text-sm hover:bg-primary dark:hover:bg-primary rounded-md shadow-sm dark:shadow-gray-700 duration-500">Audio</Link></li>
                            </ul>
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
