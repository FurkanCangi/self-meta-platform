"use client"
import React,{useState} from "react";
import Link from "next/link";
import Image from "next/image";

import Footer from "../components/footer";
import Switcher from "../components/switcher";
import Wrapper from "../components/wrapper";

import { galleryData ,images} from "../data/data";

import {Lightbox} from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";
import { AiOutlineCamera } from "react-icons/ai";

interface GalleryData{
    id: number;
    image: string;
    title: string;
    subTitle: string;
    category: string;
}

export default function Page() {
    
  let [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  let [isOpen, setisOpen] = useState<boolean>(false);
  
  let handleImageClick = (index:number) => {
      setCurrentImageIndex(index);
      setisOpen(true);
  };
  const slides = images.map((image) => ({ src: image }));

  return (
    <Wrapper>
         <div className="container-fluid relative px-3">
            <div className="layout-specing">
                <div className="md:flex justify-between items-center">
                    <h5 className="text-lg font-semibold">Gallery</h5>

                    <ul className="tracking-[0.5px] inline-flex items-center sm:mt-0 mt-3">
                        <li className="inline-block capitalize text-[14px] font-bold duration-500 dark:text-white/70 hover:text-primary dark:hover:text-white"><Link href="/">Techwind</Link></li>
                        <li className="inline-block text-base text-slate-950 dark:text-white/70 mx-0.5 ltr:rotate-0 rtl:rotate-180"><MdKeyboardArrowRight/></li>
                        <li className="inline-block capitalize text-[14px] font-bold text-primary dark:text-white" aria-current="page">Gallery</li>
                    </ul>
                </div>

                <div className="grid xl:grid-cols-5 lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 mt-6 gap-6">
                    {galleryData.map((item:GalleryData, index:number) => {
                        return(
                            <div className="group relative block overflow-hidden rounded-md duration-500" key={index}>
                                <Image src={item.image} width={0} height={0} sizes="100vw" placeholder="blur" blurDataURL={item.image} style={{width:'100%', height:'auto'}} className="group-hover:origin-center group-hover:scale-110 group-hover:rotate-3 duration-500" alt=""/>
                                <div className="absolute inset-2 group-hover:bg-white/90 dark:group-hover:bg-slate-900/90 duration-500 z-0 rounded-md"></div>

                                <div className="content duration-500">
                                    <div className="icon absolute z-10 opacity-0 group-hover:opacity-100 top-6 end-6 duration-500">
                                        <Link href="#" onClick={() => handleImageClick(item.id)} className="size-9 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-full lightbox"><AiOutlineCamera/></Link>
                                    </div>

                                    <div className="absolute z-10 opacity-0 group-hover:opacity-100 bottom-6 start-6 duration-500">
                                        <Link href="#" className="h6 text-lg font-medium hover:text-primary duration-500 ease-in-out">{item.title}</Link>
                                        <p className="text-slate-400 mb-0">{item.subTitle}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                         <Lightbox
                            open={isOpen}
                            close={() => setisOpen(false)}
                            slides={slides}
                            index={currentImageIndex} 
                        />
                </div>

                <div className="flex justify-end mt-6">
                    <nav aria-label="Page navigation example">
                        <ul className="inline-flex items-center -space-x-px">
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 bg-white dark:bg-slate-900 rounded-s-lg hover:text-white border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">
                                    <MdKeyboardArrowLeft className="text-[20px] rtl:rotate-180 rtl:-mt-1"/>
                                </Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 hover:text-white bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">1</Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 hover:text-white bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">2</Link>
                            </li>
                            <li>
                                <Link href="#" aria-current="page" className="z-10 size-10 inline-flex justify-center items-center text-white bg-primary border border-primary">3</Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 hover:text-white bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">4</Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 hover:text-white bg-white dark:bg-slate-900 border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">5</Link>
                            </li>
                            <li>
                                <Link href="#" className="size-10 inline-flex justify-center items-center text-slate-400 bg-white dark:bg-slate-900 rounded-e-lg hover:text-white border border-gray-100 dark:border-gray-700 hover:border-primary dark:hover:border-primary hover:bg-primary dark:hover:bg-primary">
                                    <MdKeyboardArrowRight className="text-[20px] rtl:rotate-180 rtl:-mt-1"/>
                                </Link>
                            </li>
                        </ul>
                    </nav>
                </div>
            </div>
        </div>
        <Footer/>
        <Switcher/>
    </Wrapper>
   
  )
}
