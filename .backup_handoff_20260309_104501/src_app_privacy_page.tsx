import React from "react";
import Link from "next/link";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";
import { MdKeyboardArrowRight } from "react-icons/md";
import { FiArrowRight } from "react-icons/fi";


export default function Page() {
  return (
    <Wrapper>
       <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <h5 className="text-lg font-semibold">Privacy Policy</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Techwind</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Privacy</li>
                    </ul>
                </div>

                <div className="container relative mt-6">
                    <div className="md:flex justify-center">
                        <div className="lg:w-4/5 w-full">
                            <div className="p-6 bg-white dark:bg-slate-900 shadow-sm dark:shadow-gray-700 rounded-md">
                                <h5 className="text-lg font-semibold mb-4">Overview :</h5>
                                <p className="text-slate-400">It seems that only fragments of the original text remain in the Lorem Ipsum texts used today. One may speculate that over the course of time certain letters were added or deleted at various positions within the text.</p>
                                <p className="text-slate-400">In the 1960s, the text suddenly became known beyond the professional circle of typesetters and layout designers when it was used for Letraset sheets (adhesive letters on transparent film, popular until the 1980s) Versions of the text were subsequently included in DTP programmes such as PageMaker etc.</p>
                                <p className="text-slate-400">There is now an abundance of readable dummy texts. These are usually used when a text is required purely to fill a space. These alternatives to the classic Lorem Ipsum texts are often amusing and tell short, funny or nonsensical stories.</p>
                            
                                <h5 className="text-lg font-semibold mb-4 mt-6">We use your information to :</h5>
                                <ul className="list-none text-slate-400 mt-4">
                                    <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Digital Marketing Solutions for Tomorrow</li>
                                    <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Our Talented & Experienced Marketing Agency</li>
                                    <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Create your own skin to match your brand</li>
                                    <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Digital Marketing Solutions for Tomorrow</li>
                                    <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Our Talented & Experienced Marketing Agency</li>
                                    <li className="flex mt-2 items-center"><FiArrowRight className="text-primary text-sm align-middle me-2"/>Create your own skin to match your brand</li>
                                </ul>
    
                                <h5 className="text-lg font-semibold mb-4 mt-6">Information Provided Voluntarily :</h5>
                                <p className="text-slate-400">In the 1960s, the text suddenly became known beyond the professional circle of typesetters and layout designers when it was used for Letraset sheets (adhesive letters on transparent film, popular until the 1980s) Versions of the text were subsequently included in DTP programmes such as PageMaker etc.</p>
    
                                <div className="mt-6">
                                    <Link href="#" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md">Print</Link>
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
