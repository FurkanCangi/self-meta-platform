"use client"
import React,{useState} from "react";
import Link from "next/link";
import Image from "next/image";

import * as Icon from 'react-feather'
import { AiOutlineClose } from "react-icons/ai";
import { FiDollarSign } from "react-icons/fi";


export default function AddProduct(){
  let [modal, setModal] = useState<boolean>(false)

  const [uploadFile, setUploadFile] = useState<string | undefined>();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.files && event.target.files.length > 0) {
      setUploadFile(URL.createObjectURL(event.target.files[0]));
    }
  }
    return(
        <>
        <div>
            <Link href="#" onClick={() => setModal(!modal)} className="size-8 inline-flex items-center justify-center tracking-wide align-middle duration-500 text-[20px] text-center bg-gray-800/5 hover:bg-gray-800/10 dark:bg-gray-700 border border-gray-800/5 dark:border-gray-800 text-slate-900 dark:text-white rounded-full"><Icon.Plus className="size-4"/></Link>
        </div>

        <div className={`fixed z-999 flex items-center justify-center overflow-hidden inset-0 m-auto bg-gray-900/70 ${modal ? '': 'hidden'}`}>
                    <div className="relative w-full h-auto max-w-lg p-4">
                        <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-sm dark:shadow-gray-700">
                            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-gray-700">
                                <h5 className="text-xl font-semibold">Add shop item</h5>
                                <button type="button" onClick={() => setModal(!modal)} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 ms-auto inline-flex items-center dark:hover:bg-gray-800 dark:hover:text-white">
                                    <AiOutlineClose className="size-5"/>  
                                </button>
                            </div>
                            <div className="p-4">
                                <div>
                                    <p className="font-semibold mb-4">Upload your shop image here, Please click Upload Image Button.</p>
                                    {uploadFile ? 
                                    <div className="preview-box flex justify-center rounded-md shadow-sm dark:shadow-gray-800 overflow-hidden bg-gray-50 dark:bg-slate-800 text-slate-400 p-2 text-center small w-auto max-h-60">
                                        <Image src={uploadFile} alt="" width={0} height={0} sizes="100vw" style={{width:'100%', height:'auto'}} className="preview-content"/> 
                                    </div>:  
                                    <div className="preview-box flex justify-center rounded-md shadow-sm dark:shadow-gray-800 overflow-hidden bg-gray-50 dark:bg-slate-800 text-slate-400 p-2 text-center small w-auto max-h-60">Supports JPG, PNG and MP4 videos. Max file size : 10MB.</div>
                                  }
                                    <input type="file" id="input-file" name="input-file" accept="image/*" hidden  onChange={(e) => handleChange(e)}/>
                                    <label className="btn-upload py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md mt-6 cursor-pointer" htmlFor="input-file">Upload Image</label>
                                </div>
                                
                                <form className="mt-4">
                                    <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-12">
                                            <label className="font-semibold">Item Name <span className="text-red-600">*</span></label>
                                            <input name="name" id="name" type="text" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Name"/>
                                        </div>
                                        
                                        <div className="md:col-span-6 col-span-12">
                                            <label className="form-label font-semibold">Price</label>
                                            <div className="relative mt-2">
                                                <span className="absolute top-0.5 start-0.5 size-9 text-xl bg-gray-100 dark:bg-slate-800 inline-flex justify-center items-center text-dark dark:text-white rounded" id="basic-addon1"><FiDollarSign/></span>
                                                <input type="text" className="form-input ps-12 w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0" placeholder="Price" required/>
                                            </div>
                                        </div>

                                        <div className="md:col-span-6 col-span-12">
                                            <label className="font-semibold">Label</label>
                                            <input name="name" id="name2" type="text" className="form-input w-full py-2 px-3 h-10 bg-transparent dark:bg-slate-900 dark:text-slate-200 rounded outline-none border border-gray-200 focus:border-primary dark:border-gray-800 dark:focus:border-primary focus:ring-0 mt-2" placeholder="Label"/>
                                        </div>

                                        <div className="col-span-12">
                                            <button type="submit" className="py-2 px-5 inline-block font-semibold tracking-wide border align-middle duration-500 text-base text-center bg-primary hover:bg-primary-700 border-primary hover:border-primary-700 text-white rounded-md">Add Item</button>
                                        </div>
                                    </div>
                                </form>
                            </div>                    
                        </div>
                    </div>
                </div>
        </>
    )
}