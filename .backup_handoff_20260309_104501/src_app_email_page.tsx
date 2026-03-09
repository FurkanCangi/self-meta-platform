import React from "react";
import Link from "next/link";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";
import Mail from "../components/mail";
import { MdKeyboardArrowRight } from "react-icons/md";


export default function Page(){
    return(
    <Wrapper>
         <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <h5 className="text-lg font-semibold">Email / Messages</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Techwind</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Emails</li>
                    </ul>
                </div>

                <Mail/>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
    )
}