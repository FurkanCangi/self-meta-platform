import React from "react";
import Link from "next/link";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";
import AccordianTwo from "../components/accordian-two";
import { MdKeyboardArrowRight } from "react-icons/md";
import { FiArrowRight } from "react-icons/fi";

export default function Page() {

  return (
    <Wrapper>
         <div className="container-fluid relative px-3">
                <div className="layout-specing">
                    <div className="md:flex justify-between items-center">
                        <h5 className="text-lg font-semibold">Terms & Conditions</h5>

                        <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                            <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Self Metacognition Institute</Link></li>
                            <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                            <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Terms</li>
                        </ul>
                    </div>

                    <div className="container relative mt-6">
                        <div className="md:flex justify-center">
                            <div className="lg:w-4/5 w-full">
                                <div className="p-6 bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md">
                                    <h5 className="text-lg font-semibold mb-4">Introduction :</h5>
                                    <p className="text-slate-400">It seems that only fragments of the original text remain in the Lorem Ipsum texts used today. One may speculate that over the course of time certain letters were added or deleted at various positions within the text.</p>
        
                                    <h5 className="text-lg font-semibold mb-4 mt-6">User Agreements :</h5>
                                    <p className="text-slate-400">The most well-known dummy text is the Lorem Ipsum, which is said to have <b className="text-red-600">originated</b> in the 16th century. Lorem Ipsum is <b className="text-red-600">composed</b> in a pseudo-Latin language which more or less <b className="text-red-600">corresponds</b> to proper Latin. It contains a series of real Latin words. This ancient dummy text is also <b className="text-red-600">incomprehensible</b>, but it imitates the rhythm of most European languages in Latin script. The <b className="text-red-600">advantage</b> of its Latin origin and the relative <b className="text-red-600">meaninglessness</b> of Lorum Ipsum is that the text does not attract attention to itself or distract the viewers <b className="text-red-600">attention</b> from the layout.</p>
                                    <p className="text-slate-400 mt-3">There is now an <b className="text-red-600">abundance</b> of readable dummy texts. These are usually used when a text is <b className="text-red-600">required purely</b> to fill a space. These alternatives to the classic Lorem Ipsum texts are often amusing and tell short, funny or <b className="text-red-600">nonsensical</b> stories.</p>
                                    <p className="text-slate-400 mt-3">It seems that only <b className="text-red-600">fragments</b> of the original text remain in the Lorem Ipsum texts used today. One may speculate that over the course of time certain letters were added or deleted at various positions within the text.</p>
                                    
                                    <h5 className="text-lg font-semibold mb-4 mt-6">Restrictions :</h5>
                                    <p className="text-slate-400">You are specifically restricted from all of the following :</p>
                                    <ul className="list-none text-slate-400 mt-3">
                                        <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Digital Marketing Solutions for Tomorrow</li>
                                        <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Our Talented & Experienced Marketing Agency</li>
                                        <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Create your own skin to match your brand</li>
                                        <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Digital Marketing Solutions for Tomorrow</li>
                                        <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Our Talented & Experienced Marketing Agency</li>
                                        <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Create your own skin to match your brand</li>
                                    </ul>
        
                                    <h5 className="text-lg font-semibold mt-6">Users Question & Answer :</h5>
        
                                   <AccordianTwo/>
        
                                    <div className="mt-6">
                                        <Link href="#" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md">Accept</Link>
                                        <Link href="#" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-transparent hover:bg-primary border-primary text-primary hover:text-white rounded-md ms-2">Decline</Link>
                                    </div>
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
