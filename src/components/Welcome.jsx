const [bannerUrl, setBannerUrl] = useState("");
const [useBannerUrl, setUseBannerUrl] = useState(false);

applyBotSettings(bot) {
    ... // existing code
    setBannerUrl(bot.banner_url || "");
    setUseBannerUrl(Boolean(bot.use_banner_url));
}

/* Header */
{useBannerUrl && bannerUrl ? (
    websiteUrl ? (
        <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="block" title="Visit website" aria-label="Visit website" style={{minHeight:56,backgroundImage:`url('${bannerUrl}')`,backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",borderBottom:liveTheme["--border-default"]?`1px solid ${liveTheme["--border-default"]}`:undefined}}>
            <div className="flex items-center justify-between w-full py-3 px-4 sm:px-6" style={{backgroundColor:"rgba(0,0,0,0.30)",color:"var(--banner-fg)"}}>
                <img src={logoSrc} alt="Brand logo" className="h-10 object-contain pointer-events-none select-none" draggable="false" />
                <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">{selected?selected.title:mode==="personalize"||mode==="formfill"?"Personalize":mode==="browse"?"Browse Demos":mode==="docs"?"Browse Documents":mode==="meeting"?"Schedule Meeting":mode==="price"?"Price Estimate":"Ask the Assistant"}</div>
            </div>
            <TabsNav mode={mode==="formfill"?"personalize":mode} tabs={tabs} />
        </a>
    ) : (
        <div className="px-4 sm:px-6" style={{backgroundImage:`url('${bannerUrl}')`,backgroundSize:"cover",backgroundPosition:"center",backgroundRepeat:"no-repeat",minHeight:56,color:"var(--banner-fg)",borderBottom:liveTheme["--border-default"]?`1px solid ${liveTheme["--border-default"]}`:undefined}}>
            <div className="flex items-center justify-between w-full py-3" style={{backgroundColor:"rgba(0,0,0,0.30)"}}>
                <button type="button" onClick={()=>{setMode("ask");setSelected(null);setLastQuestion("");requestAnimationFrame(()=>contentRef.current?.scrollTo({top:0,behavior:"auto"}))}} className="p-0 m-0 border-0 bg-transparent cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded" title="Home" aria-label="Home"><img src={logoSrc} alt="Brand logo" className="h-10 object-contain pointer-events-none select-none" draggable="false" /></button>
                <div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">{selected?selected.title:mode==="personalize"||mode==="formfill"?"Personalize":mode==="browse"?"Browse Demos":mode==="docs"?"Browse Documents":mode==="meeting"?"Schedule Meeting":mode==="price"?"Price Estimate":"Ask the Assistant"}</div>
            </div>
            <TabsNav mode={mode==="formfill"?"personalize":mode} tabs={tabs} />
        </div>
    )
) : (
    <div className="px-4 sm:px-6 bg-[var(--banner-bg)] text-[var(--banner-fg)] border-b border-[var(--border-default)]"><div className="flex items-center justify-between w-full py-3"><div className="flex items-center gap-3">{websiteUrl?<a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="inline-block focus-visible:ring-2 focus-visible:ring-white/60 rounded outline-none" title="Visit website" aria-label="Visit website"><img src={logoSrc} alt="Brand logo" className="h-10 object-contain pointer-events-none select-none" draggable="false" /></a>:<button type="button" onClick={()=>{setMode("ask");setSelected(null);setLastQuestion("");requestAnimationFrame(()=>contentRef.current?.scrollTo({top:0,behavior:"auto"}))}} className="p-0 m-0 border-0 bg-transparent cursor-pointer outline-none focus-visible:ring-2 focus-visible-ring-white/60 rounded" title="Home" aria-label="Home"><img src={logoSrc} alt="Brand logo" className="h-10 object-contain pointer-events-none select-none" draggable="false" /></button>}</div><div className="text-lg sm:text-xl font-semibold truncate max-w-[60%] text-right">{selected?selected.title:mode==="personalize"||mode==="formfill"?"Personalize":mode==="browse"?"Browse Demos":mode==="docs"?"Browse Documents":mode==="meeting"?"Schedule Meeting":mode==="price"?"Price Estimate":"Ask the Assistant"}</div></div><TabsNav mode={mode==="formfill"?"personalize":mode} tabs={tabs} /></div>
)}