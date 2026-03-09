"use client"
import React, { useEffect, useState } from 'react' 
import Link from 'next/link';
import Image from 'next/image';

import Switcher from '../components/switcher';
import BackButton from '../components/back-button';

export default function Page(){
    let [days,setDays] = useState<number>(0);
    let [hours,setHours] = useState<number>(0);
    let [minutes,setMinutes] = useState<number>(0);
    let [seconds,setSeconds] = useState<number>(0);

    let deadline = "December, 31, 2025";
  
    let getTime = () => {
      let time = Date.parse(deadline) - Date.now();
  
      setDays(Math.floor(time / (1000 * 60 * 60 * 24)));
      setHours(Math.floor((time / (1000 * 60 * 60)) % 24));
      setMinutes(Math.floor((time / 1000 / 60) % 60));
      setSeconds(Math.floor((time / 1000) % 60));
    };

    useEffect(() => {
    let interval = setInterval(() => getTime(), 1000);
      return () => clearInterval(interval);
      }, []);


    return(
   <>
    <section className="relative  bg-no-repeat bg-center bg-cover" style={{backgroundImage:"url('/images/utility.jpg')"}}>
        <div className="absolute inset-0 bg-black/25"></div>
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-black/40 to-black"></div>
        <div className="container-fluid relative">
            <div className="grid grid-cols-1">
                <div className="flex flex-col min-h-screen justify-center md:px-10 py-10 px-4">
                    <div className="text-center">
                        <Link href="/"><Image src='/images/logo-icon-64.png' width={72} height={64} placeholder='blur' blurDataURL='/images/logo-icon-64.png' className="mx-auto" alt=""/></Link>
                    </div>
                    <div className="title-heading text-center my-auto">
                        <h1 className="text-white mt-3 mb-6 md:text-5xl text-3xl font-bold">We Are Coming Soon...</h1>
                        <p className="text-white/70 text-lg max-w-xl mx-auto">Start working with Techwind that can provide everything you need to generate awareness, drive traffic, connect.</p>
                    
                        <div id="countdown">
                            <ul className="count-down list-none inline-block text-white text-center mt-8 m-6">
                                <li  className="text-[40px] leading-27.5 size-32.5 rounded-full shadow-md bg-white/10 backdrop-opacity-30 inline-block m-2">{days}<p className='count-head'>Days</p></li>
                                <li  className="text-[40px] leading-27.5 size-32.5 rounded-full shadow-md bg-white/10 backdrop-opacity-30 inline-block m-2">{hours}<p className='count-head'>Hours</p></li>
                                <li  className="text-[40px] leading-27.5 size-32.5 rounded-full shadow-md bg-white/10 backdrop-opacity-30 inline-block m-2">{minutes}<p className='count-head'>Mins</p></li>
                                <li  className="text-[40px] leading-27.5 size-32.5 rounded-full shadow-md bg-white/10 backdrop-opacity-30 inline-block m-2">{seconds}<p className='count-head'>Secs</p></li>
                                <li className="h1"></li>
                            </ul>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="mb-0 text-slate-400">© {new Date().getFullYear()} Techwind. Design & Develop with <i className="mdi mdi-heart text-red-600"></i> by <Link href="https://shreethemes.in/" target="_blank" className="text-reset">Shreethemes</Link>.</p>
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