import React from "react"
import Link from "next/link";
import Image from "next/image";

import Switcher from "../components/switcher";
import BackButton from "../components/back-button";

export default function Page(){
    
    return(
        <>
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/[0.02]"></div>
                <div className="container-fluid relative">
                    <div className="md:flex items-center">
                        <div className="xl:w-[30%] lg:w-1/3 md:w-1/2">
                            <div className="relative md:flex flex-col md:min-h-screen justify-center bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 md:px-10 py-10 px-4 z-1">
                                <div className="text-center">
                                    <Link href="/"><Image src='/images/logo-icon-64.png' width={72} height={64} placeholder="blur" blurDataURL="/images/logo-icon-64.png"  className="mx-auto" alt=""/></Link>
                                </div>
                                <div className="title-heading text-center md:my-auto my-20">
                                    <form  className="text-start">
                                        <div className="grid grid-cols-1">
                                            <div className="mb-4">
                                                <label className="font-semibold" htmlFor="RegisterName">Your Name:</label>
                                                <input id="RegisterName" type="text" className="form-input mt-3 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Harry"/>
                                            </div>
                            
                                            <div className="mb-4">
                                                <label className="font-semibold" htmlFor="LoginEmail">Email Address:</label>
                                                <input id="LoginEmail" type="email" className="form-input mt-3 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="name@example.com"/>
                                            </div>
                            
                                            <div className="mb-4">
                                                <label className="font-semibold" htmlFor="LoginPassword">Password:</label>
                                                <input id="LoginPassword" type="password" className="form-input mt-3 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Password:"/>
                                            </div>
                            
                                            <div className="mb-4">
                                                <div className="flex items-center w-full mb-0">
                                                    <input className="form-checkbox size-4 appearance-none rounded border border-gray-200 dark:border-gray-800 accent-primary checked:appearance-auto dark:accent-primary focus:border-primary-300 focus:ring-0 focus:ring-offset-0 focus:ring-primary-200 focus:ring-opacity-50 me-2" type="checkbox" value="" id="AcceptT&C"/>
                                                    <label className="form-check-label text-slate-400" htmlFor="AcceptT&C">I Accept <Link href="" className="text-primary">Terms And Condition</Link></label>
                                                </div>
                                            </div>
                            
                                            <div className="mb-4">
                                                <input type="submit" className="py-2 px-5 inline-block tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md w-full" value="Register"/>
                                            </div>
                            
                                            <div className="text-center">
                                                <span className="text-slate-400 me-2">Already have an account ? </span> <Link href="/auth-login" className="text-black dark:text-white font-bold inline-block">Sign in</Link>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                                <div className="text-center">
                                    <p className="mb-0 text-slate-400">© {new Date().getFullYear()} Self Metacognition Institute. Design & Develop with <i className="mdi mdi-heart text-red-600"></i> by <Link href="https://shreethemes.in/" target="_blank" className="text-reset">Shreethemes</Link>.</p>
                                </div>
                            </div>
                        </div>

                        <div className="xl:w-[70%] lg:w-2/3 md:w-1/2 flex justify-center mx-6 md:my-auto my-20">
                            <div>
                                <div className="relative">
                                    <div className="absolute top-20 start-20 bg-primary/[0.02] size-300 rounded-full"></div>
                                    <div className="absolute bottom-20 -end-20 bg-primary/[0.02] size-150 rounded-full"></div>
                                </div>
        
                                <div className="text-center">
                                    <div>
                                        <Image src='/images/contact.svg' width={0} height={0} sizes="100vw" placeholder="blur" blurDataURL="/images/contact.svg" style={{width:"100%", height:'auto'}} className="max-w-xl mx-auto" alt=""/>
                                        <div className="relative max-w-xl mx-auto text-start">
                                            <div className="relative p-8 border-2 border-primary rounded-[30px] before:content-[''] before:absolute before:w-28 before:border-[6px] before:border-white dark:before:border-slate-900 before:-bottom-1 before:start-16 before:z-2 after:content-[''] after:absolute after:border-2 after:border-primary after:rounded-none after:rounded-e-[50px] after:size-20 after:-bottom-20 after:start-15 after:z-3 after:border-s-0 after:border-b-0">
                                                <span className="font-semibold leading-normal">
                                                    Launch your campaign and benefit from our expertise on designing and managing conversion centered latest Tailwind CSS html page.
                                                </span>
                
                                                <div className="absolute text-8xl -top-0 start-4 text-primary/10 dark:text-primary/20 -z-1">
                                                    <i className="mdi mdi-format-quote-open"></i>
                                                </div>
                                            </div>
                
                                            <div className="text-lg font-semibold mt-6 ms-44">
                                                - Self Metacognition Institute
                                            </div>
                                        </div>
                                        <p className="text-slate-400 max-w-xl mx-auto">Start working with Tailwind CSS that can provide everything you need to generate awareness, drive traffic, connect. Dummy text is text that is used in the publishing industry or by web designers to occupy the space which will later be filled with real content.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <Switcher/>
            <BackButton/>
        </>
    )
}