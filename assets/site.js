(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => value === null || value === undefined || value === '' || Number(value) <= 0
    ? 'Consulte o valor'
    : Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const config = window.SUPABASE_CONFIG || {};
  const configured = typeof config.url === 'string' && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url)
    && typeof config.anonKey === 'string' && config.anonKey.length > 20 && !config.anonKey.startsWith('COLE_');
  const client = configured && window.supabase?.createClient ? window.supabase.createClient(config.url, config.anonKey) : null;
  let products = [];
  let settings = {store_name:'Sútil Laser',brand_mark:'S·L',brand_logo_url:'',accent_color:'#a98656',tagline:'Personalizados com significado',instagram_url:'https://www.instagram.com/sutillaser/',whatsapp_number:'',contact_email:''};
  let activeCategory = 'Todos';
  let selectedProduct = null;
  let quoteItems = [];
  let logoObjectUrl = null;
  let modelRotation = 0;
  let modelTilt = -5;
  let draggingModel = false;
  let dragStart = null;
  let bottleRenderer=null, bottleScene=null, bottleCamera=null, bottleRoot=null, bottleDecalCanvas=null, bottleDecalContext=null, bottleDecalTexture=null, bottleLogoImage=null;
  const REFERENCE_BOTTLE = {
    id:'garrafa-termica-azul',
    name:'Garrafa térmica azul com tampa',
    category:'Garrafas',
    description:'Garrafa térmica azul com acabamento fosco, detalhes em aço inox e tampa preta. Personalização sob consulta.',
    price:null, price_label:'Consulte o valor',
    image_url:'assets/garrafa-azul-sem-nome.jpg',
    gallery:[], model_type:'bottle',
    personalization:{text:true,logo:true,font:true,color:true,position:true,size:true},
    featured:true, active:true, sort_order:-1000
  };
  function ensureReferenceBottle(list) {
    const exists = list.some(p => String(p.id)===REFERENCE_BOTTLE.id);
    return exists ? list : [REFERENCE_BOTTLE,...list];
  }

  function toast(message) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => el.classList.remove('show'), 3300);
  }
  function validExternalUrl(value, fallback='') {
    if (typeof value !== 'string' || !value.trim()) return fallback;
    try {
      const u = new URL(value, location.href);
      return ['https:'].includes(u.protocol) ? u.href : fallback;
    } catch { return fallback; }
  }
  function displaySettings() {
    const name = settings.store_name || 'Sútil Laser';
    document.title = name + ' | Personalizados com significado';
    document.querySelector('meta[property="og:title"]')?.setAttribute('content',name+' | Personalizados com significado');
    document.querySelector('meta[property="og:description"]')?.setAttribute('content',settings.tagline || 'Peças e presentes personalizados.');
    $('#heroIndex').textContent = 'COLEÇÃO · '+name.toLocaleUpperCase('pt-BR');
    $('#heroPlaceholderMark').textContent = settings.brand_mark || 'S';
    $('#storyVisual').dataset.brand = settings.brand_mark || 'S·L';
    $('#stagePlaceholder').textContent = settings.brand_mark || 'Sútil';
    document.querySelectorAll('.brand-name').forEach(el => { el.textContent = name.toLocaleUpperCase('pt-BR'); });
    $('#footerStore').textContent = name;
    document.querySelectorAll('.brand-mark').forEach(mark => {
      const logo = validExternalUrl(settings.brand_logo_url, '');
      if (logo) mark.innerHTML = '<img src="'+escapeHtml(logo)+'" alt="'+escapeHtml(name)+'">';
      else mark.textContent = settings.brand_mark || 'S·L';
    });
    if (/^#[0-9a-f]{6}$/i.test(settings.accent_color || '')) document.documentElement.style.setProperty('--gold', settings.accent_color);
    $('#heroDescription').textContent = settings.tagline || 'Personalizamos peças e presentes com gravação a laser, transformando ideias em lembranças com significado.';
    const insta = validExternalUrl(settings.instagram_url, 'https://www.instagram.com/');
    $('#footerInstagram').href = insta;
    $('#contactLink').href = insta;
    if (settings.whatsapp_number && String(settings.whatsapp_number).replace(/\D/g,'').length >= 10) {
      $('#contactLink').href = 'https://wa.me/' + String(settings.whatsapp_number).replace(/\D/g,'');
      $('#contactLink').textContent = 'Falar pelo WhatsApp ↗';
    }
  }
  function localProducts(list) {
    return list.map(p => ({
      id:p.id, name:p.name, category:p.category, description:p.description || p.short_description || '',
      price:p.price, price_label:p.price_label, image_url:p.image_url || p.image || '',
      gallery:p.gallery || [], model_type:p.model_type || p.model || 'other',
      personalization:p.personalization || {text:true,logo:true,font:true,color:true,position:true,size:true},
      featured:!!p.featured, active:p.active !== false, sort_order:p.sort_order || 0
    }));
  }
  async function loadData() {
    if (client) {
      try {
        const [productsResult, settingsResult] = await Promise.all([
          client.from('products').select('*').eq('active',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false}),
          client.from('store_settings').select('*').eq('id',1).maybeSingle()
        ]);
        if (productsResult.error) throw productsResult.error;
        products = ensureReferenceBottle(productsResult.data || []);
        if (settingsResult.data) settings = {...settings,...settingsResult.data};
        displaySettings();
        renderProducts();
        renderHeroImage();
        return;
      } catch (error) {
        console.error('Falha ao carregar o catálogo do Supabase:', error);
        toast('Não foi possível atualizar a coleção. Exibindo os dados de demonstração.');
      }
    }
    try {
      const response = await fetch('data/catalog.json',{cache:'no-store'});
      if (!response.ok) throw new Error('Catálogo local indisponível');
      const local = await response.json();
      products = ensureReferenceBottle(localProducts(local).filter(product => product.active));
    } catch (error) {
      console.error(error);
      products = [];
    }
    displaySettings();
    renderProducts();
    renderHeroImage();
  }
  function renderHeroImage() {
    const featured = products.find(p => p.featured && p.image_url) || products.find(p => p.image_url);
    if (featured) {
      $('#heroProduct').innerHTML = '<img src="' + escapeHtml(featured.image_url) + '" alt="' + escapeHtml(featured.name) + '" loading="eager" onerror="this.remove()">';
    }
  }
  function categories() {
    return ['Todos',...new Set(products.map(p => p.category).filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR')))];
  }
  function renderFilters() {
    $('#filters').innerHTML = categories().map(category =>
      '<button type="button" class="filter '+(category===activeCategory?'active':'')+'" data-category="'+escapeHtml(category)+'" aria-pressed="'+(category===activeCategory)+'">'+escapeHtml(category)+'</button>'
    ).join('');
  }
  function photoMarkup(product) {
    const image = product.image_url || (Array.isArray(product.gallery) && product.gallery[0]) || '';
    if (image) return '<img loading="lazy" src="'+escapeHtml(image)+'" alt="'+escapeHtml(product.name)+'" onerror="this.parentElement.innerHTML=\'<div class=&quot;photo-empty&quot;><div><span>SL</span><small>foto em atualização</small></div></div>\'">';
    return '<div class="photo-empty"><div><span>SL</span><small>imagem em atualização</small></div></div>';
  }
  function filteredProducts() {
    const query = $('#search').value.trim().toLocaleLowerCase('pt-BR');
    return products.filter(p => (activeCategory==='Todos' || p.category===activeCategory)
      && (!query || [p.name,p.category,p.description].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
  }
  function renderProducts() {
    renderFilters();
    const list = filteredProducts();
    $('#catalogCount').textContent = list.length + (list.length===1?' peça encontrada':' peças encontradas');
    $('#products').innerHTML = list.length ? list.map(p => `
      <article class="product-card">
        <div class="product-photo">${photoMarkup(p)}${p.featured?'<span class="featured-tag">Escolha especial</span>':''}</div>
        <div class="product-info">
          <span class="product-category">${escapeHtml(p.category || 'Coleção')}</span>
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || 'Peça disponível para personalização sob consulta.')}</p>
          <div class="product-foot"><span class="product-price">${escapeHtml(p.price_label || money(p.price))}</span>
            <button class="product-open" type="button" data-product="${escapeHtml(p.id)}">Conhecer peça ↗</button>
          </div>
        </div>
      </article>`).join('') : '<div class="catalog-empty">Não encontramos peças com esse filtro. Experimente outra busca ou fale com a equipe.</div>';
  }
  function fieldVisible(field, key, defaults=true) {
    const enabled = selectedProduct?.personalization?.[key] ?? defaults;
    const element = $('#' + field);
    if (element) element.hidden = !enabled;
  }

  function resolveModelType(product) {
    const explicit = String(product.model_type || product.model || '').toLowerCase();
    if (['cup','bottle','goblet'].includes(explicit)) return explicit;
    const name = String(product.name || '').toLocaleLowerCase('pt-BR');
    if (/garrafa|squeeze/.test(name)) return 'bottle';
    if (/taça|taca|cuia/.test(name)) return 'goblet';
    if (/copo|caneca/.test(name)) return 'cup';
    return 'other';
  }
  function build3DModel(type) {
    if (type === 'bottle') return '<canvas id="bottle3dCanvas" class="bottle-3d-canvas" aria-label="Garrafa térmica em modelo tridimensional interativo"></canvas><div class="bottle-3d-hint">Arraste a garrafa para girar · modelo 3D real</div>';
    const shape = type === 'goblet' ? 'model-goblet' : 'model-cup';
    return '<div class="model-3d-shadow"></div><div class="model-3d-object '+shape+'" id="modelObject" aria-label="Modelo tridimensional ilustrativo do produto"><div class="model-back"></div><div class="model-side"></div><div class="model-front"><div class="model-rim"></div><img class="model-logo" alt="" hidden><div class="model-engraving" id="modelEngraving"></div><div class="model-base"></div></div></div><div class="model-3d-hint">Arraste para girar · prévia ilustrativa</div>';
  }
  function update3DModel() {
    const object = $('#modelObject');
    if (object) object.style.transform = 'translate(-50%,-50%) rotateX('+modelTilt+'deg) rotateY('+modelRotation+'deg)';
    if (bottleRenderer && bottleScene && bottleCamera) bottleRenderer.render(bottleScene,bottleCamera);
  }
  function rotateModelBy(delta) {
    if (bottleRoot) {
      bottleRoot.rotation.y += THREE.MathUtils.degToRad(delta);
      update3DModel();
      return;
    }
    modelRotation = (modelRotation + delta) % 360;
    update3DModel();
  }
  function finishTexture(kind) {
    const canvas=document.createElement('canvas');
    canvas.width=1024; canvas.height=1024;
    const ctx=canvas.getContext('2d');
    if(kind==='blue') {
      const gradient=ctx.createLinearGradient(0,0,1024,0);
      gradient.addColorStop(0,'#15205f'); gradient.addColorStop(.22,'#27358f'); gradient.addColorStop(.52,'#202b78'); gradient.addColorStop(.78,'#111b59'); gradient.addColorStop(1,'#1d286f');
      ctx.fillStyle=gradient; ctx.fillRect(0,0,1024,1024);
      const img=ctx.getImageData(0,0,1024,1024);
      for(let i=0;i<img.data.length;i+=4){const n=(Math.random()-.5)*12;img.data[i]+=n;img.data[i+1]+=n;img.data[i+2]+=n;img.data[i+3]=255;}
      ctx.putImageData(img,0,0);
    } else {
      const g=ctx.createLinearGradient(0,0,0,1024);
      g.addColorStop(0,'#d9dcda');g.addColorStop(.25,'#8b9290');g.addColorStop(.48,'#f5f5ef');g.addColorStop(.72,'#9ca3a0');g.addColorStop(1,'#d9dcda');
      ctx.fillStyle=g;ctx.fillRect(0,0,1024,1024);
      for(let i=0;i<2400;i++){const y=Math.random()*1024;ctx.fillStyle=Math.random()>.5?'rgba(255,255,255,.10)':'rgba(35,41,42,.07)';ctx.fillRect(0,y,1024,Math.random()*1.2);}
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.encoding=THREE.sRGBEncoding;
    texture.anisotropy=8;
    return texture;
  }
  function addLathe(parent,points,material) {
    const geometry=new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0],p[1])),128);
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function drawBottlePersonalization() {
    if(!bottleDecalContext||!bottleDecalTexture)return;
    const c=bottleDecalCanvas,ctx=bottleDecalContext;
    ctx.clearRect(0,0,c.width,c.height);
    const text=$('#customText')?.value.trim()||'';
    const size=Number($('#customSize')?.value||23);
    const x=c.width*(Number($('#customPositionX')?.value||50)/100);
    const y=c.height*(Number($('#customPosition')?.value||52)/100);
    const color=$('#customColor')?.value||'#a98656';
    const font=$('#customFont')?.value||'serif';
    if(text){
      const family=font==='sans'?'Arial, sans-serif':font==='script'?'cursive':'Georgia, serif';
      ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.font='600 '+Math.round(size*3.05)+'px '+family;
      ctx.shadowColor='rgba(255,255,255,.32)';ctx.shadowBlur=2;
      ctx.fillText(text,0,0,Math.min(850,c.width*.78));ctx.restore();
    }
    if(bottleLogoImage && bottleLogoImage.complete && bottleLogoImage.naturalWidth){
      const maxW=245,maxH=190,ratio=Math.min(maxW/bottleLogoImage.naturalWidth,maxH/bottleLogoImage.naturalHeight);
      const w=bottleLogoImage.naturalWidth*ratio,h=bottleLogoImage.naturalHeight*ratio;
      ctx.drawImage(bottleLogoImage,x-w/2,y-h/2,w,h);
    }
    bottleDecalTexture.needsUpdate=true;
    if(bottleRenderer&&bottleScene&&bottleCamera)bottleRenderer.render(bottleScene,bottleCamera);
  }
  function destroyBottle3D() {
    const oldStage=$('#model3d');
    oldStage?._bottleResizeObserver?.disconnect();
    if(oldStage) oldStage._bottleResizeObserver=null;
    if(bottleRenderer){
      bottleRenderer.dispose();
      bottleRenderer.forceContextLoss?.();
    }
    bottleRenderer=null;bottleScene=null;bottleCamera=null;bottleRoot=null;
    bottleDecalCanvas=null;bottleDecalContext=null;bottleDecalTexture=null;bottleLogoImage=null;
  }
  function initializeBottle3D() {
    const stage=$('#model3d'),canvas=$('#bottle3dCanvas');
    if(!stage||!canvas)return;
    if(!window.THREE){
      stage.classList.remove('bottle-stage');
      const img=$('#previewImage');
      if(img?.src){img.hidden=false;$('#stagePlaceholder').hidden=true;}
      toast('O visualizador 3D não carregou. A foto do produto ficará disponível como alternativa.');
      return;
    }
    destroyBottle3D();
    try{
      const width=Math.max(280,stage.clientWidth),height=Math.max(280,stage.clientHeight);
      bottleRenderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
      bottleRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
      bottleRenderer.setSize(width,height,false);
      bottleRenderer.outputEncoding=THREE.sRGBEncoding;
      bottleRenderer.toneMapping=THREE.ACESFilmicToneMapping;
      bottleRenderer.toneMappingExposure=1.12;
      bottleScene=new THREE.Scene();
      bottleCamera=new THREE.PerspectiveCamera(34,width/height,.1,100);
      bottleCamera.position.set(3.0,3.1,7.8);
      bottleCamera.lookAt(0,1.55,0);
      bottleScene.add(new THREE.HemisphereLight(0xf8f5ed,0x343b56,2.05));
      const key=new THREE.DirectionalLight(0xfff2dc,3.5);key.position.set(-4,7,6);bottleScene.add(key);
      const fill=new THREE.DirectionalLight(0xffffff,2.25);fill.position.set(5,4,3);bottleScene.add(fill);
      const rim=new THREE.DirectionalLight(0x9eb7ff,2.2);rim.position.set(-4,3,-5);bottleScene.add(rim);
      const front=new THREE.PointLight(0xffffff,18,20);front.position.set(1,4,6);bottleScene.add(front);
      bottleRoot=new THREE.Group();bottleScene.add(bottleRoot);
      const shell=new THREE.Group();shell.rotation.y=-Math.PI/2;bottleRoot.add(shell);
      const blueMap=finishTexture('blue'),steelMap=finishTexture('steel');
      const blueMat=new THREE.MeshStandardMaterial({map:blueMap,color:0xffffff,metalness:.22,roughness:.39});
      const steelMat=new THREE.MeshStandardMaterial({map:steelMap,metalness:.82,roughness:.27});
      const blackMat=new THREE.MeshStandardMaterial({color:0x101114,metalness:.12,roughness:.27});
      const darkMat=new THREE.MeshStandardMaterial({color:0x050607,metalness:.06,roughness:.34});
      addLathe(shell,[[.695,.10],[.70,.15],[.70,.42],[.735,.54],[.77,.62],[.77,.66]],steelMat);
      const blueBody=addLathe(shell,[[.70,.48],[.715,.54],[.77,.62],[.82,.72],[.94,2.42],[.96,2.52],[.955,2.58]],blueMat);
      addLathe(shell,[[.94,2.43],[.98,2.47],[1.0,2.55],[1.035,2.83],[1.03,2.90],[.97,2.91],[.955,2.84],[.955,2.53]],steelMat);
      const lowerLip=new THREE.Mesh(new THREE.TorusGeometry(.715,.035,16,100),steelMat);lowerLip.rotation.x=Math.PI/2;lowerLip.position.y=.17;shell.add(lowerLip);
      const lidBand=new THREE.Mesh(new THREE.CylinderGeometry(1.045,1.045,.16,128),blackMat);lidBand.position.y=2.94;lidBand.castShadow=true;shell.add(lidBand);
      const lidRim=new THREE.Mesh(new THREE.TorusGeometry(1.035,.055,20,120),darkMat);lidRim.rotation.x=Math.PI/2;lidRim.position.y=2.91;shell.add(lidRim);
      const lidTop=new THREE.Mesh(new THREE.CylinderGeometry(.94,.98,.075,128),blackMat);lidTop.position.y=3.055;shell.add(lidTop);
      const tab=new THREE.Mesh(new THREE.BoxGeometry(.68,.105,.22),blackMat);tab.position.set(0,3.13,-.14);tab.castShadow=true;shell.add(tab);
      const tabLeft=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.18,24),blackMat);tabLeft.rotation.z=Math.PI/2;tabLeft.position.set(-.25,3.08,-.14);shell.add(tabLeft);
      const tabRight=tabLeft.clone();tabRight.position.x=.25;shell.add(tabRight);
      const decalCanvas=document.createElement('canvas');decalCanvas.width=1024;decalCanvas.height=1024;
      bottleDecalCanvas=decalCanvas;bottleDecalContext=decalCanvas.getContext('2d');
      bottleDecalTexture=new THREE.CanvasTexture(decalCanvas);bottleDecalTexture.encoding=THREE.sRGBEncoding;bottleDecalTexture.anisotropy=8;
      const decalMat=new THREE.MeshBasicMaterial({map:bottleDecalTexture,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
      const decal=new THREE.Mesh(new THREE.CylinderGeometry(.962,.824,1.89,128,1,true,Math.PI/2-.57,1.14),decalMat);
      decal.position.y=1.55;decal.renderOrder=3;shell.add(decal);
      // Uma sombra suave de estúdio mantém a garrafa ancorada no palco.
      const shadowCanvas=document.createElement('canvas');shadowCanvas.width=256;shadowCanvas.height=256;
      const sctx=shadowCanvas.getContext('2d'),grad=sctx.createRadialGradient(128,128,8,128,128,122);
      grad.addColorStop(0,'rgba(28,27,25,.28)');grad.addColorStop(1,'rgba(28,27,25,0)');
      sctx.fillStyle=grad;sctx.fillRect(0,0,256,256);
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.5,2.0),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;shadow.position.y=.045;bottleScene.add(shadow);
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe9e4d9,roughness:.95}));
      floor.rotation.x=-Math.PI/2;floor.position.y=.025;floor.receiveShadow=true;bottleScene.add(floor);
      bottleRoot.rotation.set(-.035,-.24,0);
      const resize=()=>{
        if(!bottleRenderer||!bottleCamera)return;
        const w=Math.max(280,stage.clientWidth),h=Math.max(280,stage.clientHeight);
        bottleRenderer.setSize(w,h,false);bottleCamera.aspect=w/h;bottleCamera.updateProjectionMatrix();
        bottleRenderer.render(bottleScene,bottleCamera);
      };
      if(window.ResizeObserver){const observer=new ResizeObserver(resize);observer.observe(stage);stage._bottleResizeObserver=observer;}
      const onDown=e=>{if(e.button!==undefined&&e.button!==0)return;canvas.setPointerCapture(e.pointerId);dragStart={x:e.clientX,y:e.clientY,rx:bottleRoot.rotation.x,ry:bottleRoot.rotation.y};};
      const onMove=e=>{if(!dragStart)return;bottleRoot.rotation.y=dragStart.ry+(e.clientX-dragStart.x)*.012;bottleRoot.rotation.x=Math.max(-.35,Math.min(.35,dragStart.rx+(e.clientY-dragStart.y)*.006));bottleRenderer.render(bottleScene,bottleCamera);};
      const onUp=()=>{dragStart=null;};
      canvas.addEventListener('pointerdown',onDown);canvas.addEventListener('pointermove',onMove);
      ['pointerup','pointercancel','lostpointercapture'].forEach(type=>canvas.addEventListener(type,onUp));
      drawBottlePersonalization();
      bottleRenderer.render(bottleScene,bottleCamera);
      stage.classList.add('bottle-stage');
    }catch(error){
      console.error('Falha ao iniciar o modelo 3D:',error);
      destroyBottle3D();
      const img=$('#previewImage');
      if(img?.src){img.hidden=false;$('#stagePlaceholder').hidden=true;}
      toast('Não foi possível iniciar o 3D neste navegador. A foto continua disponível.');
    }
  }

  function openCustomizer(product) {
    selectedProduct = product;
    $('#modalTitle').textContent = product.name;
    $('#customText').value = '';
    $('#customLogo').value = '';
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = null;
    $('#logoPreview').hidden = true;
    $('#textPreview').textContent = 'Seu nome';
    $('#textPreview').style.fontFamily = 'var(--serif)';
    $('#textPreview').style.fontSize = '23px';
    $('#textPreview').style.color = '#a98656';
    $('#customFont').value = 'serif';
    $('#customColor').value = '#a98656';
    $('#customSize').value = '23';
    $('#customPosition').value = '52';
    $('#customPositionX').value = '50';
    $('#customQuantity').value = '1';
    const image = product.image_url || (Array.isArray(product.gallery) && product.gallery[0]) || '';
    const previewImage = $('#previewImage');
    const modelType = resolveModelType(product);
    const modelStage = $('#model3d');
    const use3D = modelType !== 'other';
    destroyBottle3D();
    bottleLogoImage = null;
    modelStage.hidden = !use3D;
    previewImage.hidden = !image;
    if (use3D) {
      modelStage.dataset.type = modelType;
      modelStage.innerHTML = build3DModel(modelType);
      modelRotation = -18; modelTilt = -5;
      update3DModel();
      $('#stagePlaceholder').hidden = true;
      if(modelType==='bottle') requestAnimationFrame(initializeBottle3D);
    }
    previewImage.onload = () => { previewImage.hidden = false; $('#stagePlaceholder').hidden = true; };
    previewImage.onerror = () => { previewImage.hidden = true; $('#stagePlaceholder').hidden = false; };
    if (image) previewImage.src = image; else previewImage.removeAttribute('src');
    if (!use3D) $('#stagePlaceholder').hidden = !!image;
    if (use3D && image) { previewImage.src=image; }
    $('#engravingOverlay').style.top = '52%';
    $('#engravingOverlay').style.left = '50%';
    $('#engravingOverlay').classList.toggle('on-3d-model', use3D);
    fieldVisible('textField','text');
    fieldVisible('logoField','logo');
    fieldVisible('fontField','font');
    fieldVisible('colorField','color');
    fieldVisible('positionField','position');
    fieldVisible('positionXField','position');
    fieldVisible('sizeField','size');
    $('#customModal').classList.add('open');
    document.body.classList.add('locked');
    $('#modalClose').focus();
  }
  function closeCustomizer() {
    $('#customModal').classList.remove('open');
    document.body.classList.remove('locked');
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = null;
    destroyBottle3D();
    selectedProduct = null;
  }
  function updatePreview() {
    const text = $('#customText').value.trim();
    const el = $('#textPreview');
    el.textContent = text || 'Seu nome';
    const font = $('#customFont').value;
    el.style.fontFamily = font==='sans' ? 'var(--sans)' : font==='script' ? 'cursive' : 'var(--serif)';
    el.style.fontSize = $('#customSize').value + 'px';
    el.style.color = $('#customColor').value;
    $('#engravingOverlay').style.top = $('#customPosition').value + '%';
    $('#engravingOverlay').style.left = $('#customPositionX').value + '%';
    const modelText = $('#model3d .model-engraving');
    if (modelText) {
      modelText.textContent = text || 'Seu nome';
      modelText.style.fontFamily = font==='sans' ? 'var(--sans)' : font==='script' ? 'cursive' : 'var(--serif)';
      modelText.style.fontSize = Math.max(10,Number($('#customSize').value)*.72)+'px';
      modelText.style.color = $('#customColor').value;
      modelText.style.top = $('#customPosition').value+'%';
      modelText.style.left = $('#customPositionX').value+'%';
      const modelLogo = $('#model3d .model-logo');
      if (modelLogo) { modelLogo.src = $('#logoPreview').src || ''; modelLogo.hidden = $('#logoPreview').hidden; }
    }
    drawBottlePersonalization();
    update3DModel();
  }
  function addToQuote() {
    if (!selectedProduct) return;
    if (quoteItems.length >= 15) {
      toast('Sua lista chegou ao limite de 15 itens. Envie esta solicitação antes de adicionar mais.');
      return;
    }
    const file = $('#customLogo').files[0];
    const options = selectedProduct.personalization || {};
    const enabled = key => options[key] !== false;
    const quantity = Math.min(999,Math.max(1,Number.parseInt($('#customQuantity').value,10)||1));
    quoteItems.push({
      key:crypto.randomUUID(),
      productId:selectedProduct.id,
      name:selectedProduct.name,
      priceLabel:selectedProduct.price_label || money(selectedProduct.price),
      quantity,
      text:enabled('text') ? ($('#customText').value.trim() || 'A combinar') : '',
      font:enabled('font') ? $('#customFont').selectedOptions[0].text : '',
      color:enabled('color') ? $('#customColor').selectedOptions[0].text : '',
      size:enabled('size') ? $('#customSize').value : '',
      positionY:enabled('position') ? $('#customPosition').value : '',
      positionX:enabled('position') ? $('#customPositionX').value : '',
      logoFilename:enabled('logo') && file ? file.name : ''
    });
    renderQuote();
    closeCustomizer();
    toast('Peça adicionada à sua seleção.');
  }
  function renderQuote() {
    $('#quoteCount').textContent = String(quoteItems.length);
    $('#quoteItems').innerHTML = quoteItems.length ? quoteItems.map(item => {
      const details = [
        'Quantidade: '+item.quantity,
        item.text ? 'Texto: '+item.text : '',
        item.font ? 'Letra: '+item.font : '',
        item.color ? 'Tom: '+item.color : '',
        item.size ? 'Tamanho: '+item.size : '',
        item.positionY ? 'Altura: '+item.positionY : '',
        item.positionX ? 'Largura: '+item.positionX : '',
        item.logoFilename ? 'Arte para anexar: '+item.logoFilename : '',
        item.priceLabel
      ].filter(Boolean).join('\\n');
      return '<article class="quote-item"><div><h3>'+escapeHtml(item.name)+'</h3><p>'+escapeHtml(details)+'</p></div><button class="quote-remove" type="button" data-remove-quote="'+escapeHtml(item.key)+'">Remover</button></article>';
    }).join('') : '<div class="catalog-empty">Sua seleção ainda está vazia. Explore a coleção e adicione as peças que deseja consultar.</div>';
  }
  function openQuote() {
    renderQuote();
    $('#quoteModal').classList.add('open');
    document.body.classList.add('locked');
    $('#quoteClose').focus();
  }
  function closeQuote() {
    $('#quoteModal').classList.remove('open');
    document.body.classList.remove('locked');
  }
  function buildQuoteMessage() {
    const lines = [
      'Olá! Gostaria de solicitar um orçamento para os itens abaixo.',
      '',
      ...quoteItems.map((item,index) => [
        (index+1)+') '+item.name,
        'Quantidade: '+item.quantity,
        'Preço exibido: '+item.priceLabel,
        item.text ? 'Texto: '+item.text : '',
        item.font ? 'Estilo da letra: '+item.font : '',
        item.color ? 'Tom ilustrativo: '+item.color : '',
        item.size ? 'Tamanho de referência: '+item.size : '',
        item.positionY ? 'Altura: '+item.positionY : '',
        item.positionX ? 'Largura: '+item.positionX : '',
        'Arquivo de referência: '+(item.logoFilename ? item.logoFilename+' (vou anexar na conversa)' : 'não anexado')
      ].filter(Boolean).join('\\n'))
    ];
    lines.push('','Por favor, confirmem disponibilidade, preço final, prazo e a arte antes da produção.');
    return lines.join('\\n');
  }
  async function sendQuote() {
    if (!quoteItems.length) {
      toast('Adicione ao menos uma peça à sua seleção.');
      return;
    }
    const message = buildQuoteMessage();
    const digits = String(settings.whatsapp_number || '').replace(/\\D/g,'');
    if (digits.length >= 10) {
      window.open('https://wa.me/'+digits+'?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');
      toast('Abrindo o WhatsApp com sua lista de orçamento.');
      return;
    }
    const instagram = validExternalUrl(settings.instagram_url,'https://www.instagram.com/');
    window.open(instagram,'_blank','noopener,noreferrer');
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        copied = true;
      }
    } catch (error) { console.warn('Área de transferência indisponível',error); }
    toast(copied ? 'Resumo copiado. Cole no direct e anexe os arquivos de arte, se houver.' : 'Envie os detalhes da sua seleção pelo direct.');
  }
  $('#filters').addEventListener('click',event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    activeCategory = button.dataset.category;
    renderProducts();
  });
  $('#search').addEventListener('input',renderProducts);
  $('#products').addEventListener('click',event => {
    const button = event.target.closest('[data-product]');
    if (!button) return;
    const product = products.find(p => String(p.id)===button.dataset.product);
    if (product) openCustomizer(product);
  });
  $('#customText').addEventListener('input',updatePreview);
  $('#modelRotateLeft').addEventListener('click',()=>rotateModelBy(-25));
  $('#modelRotateRight').addEventListener('click',()=>rotateModelBy(25));
  $('#model3d').addEventListener('pointerdown',event=>{if(!$('#modelObject'))return;draggingModel=true;dragStart={x:event.clientX,y:event.clientY,rotation:modelRotation,tilt:modelTilt};$('#model3d').setPointerCapture(event.pointerId);});
  $('#model3d').addEventListener('pointermove',event=>{if(!draggingModel||!dragStart)return;modelRotation=dragStart.rotation+(event.clientX-dragStart.x)*.8;modelTilt=Math.max(-22,Math.min(18,dragStart.tilt-(event.clientY-dragStart.y)*.35));update3DModel();});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>$('#model3d').addEventListener(type,()=>{draggingModel=false;dragStart=null;}));
  ['customFont','customColor','customSize','customPosition','customPositionX'].forEach(id => $('#'+id).addEventListener('input',updatePreview));
  $('#customQuantity').addEventListener('change',event => {
    const value=Math.min(999,Math.max(1,Number.parseInt(event.target.value,10)||1));
    event.target.value=String(value);
  });
  $('#customLogo').addEventListener('change',event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) || file.size > 5*1024*1024) {
      event.target.value = '';
      toast('Escolha PNG, JPG, WEBP ou SVG de até 5 MB.');
      return;
    }
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    logoObjectUrl = URL.createObjectURL(file);
    $('#logoPreview').src = logoObjectUrl;
    $('#logoPreview').hidden = false;
    const modelLogo = $('#model3d .model-logo');
    if (modelLogo) { modelLogo.src = logoObjectUrl; modelLogo.hidden = false; }
    bottleLogoImage = new Image();
    bottleLogoImage.onload = drawBottlePersonalization;
    bottleLogoImage.src = logoObjectUrl;
    drawBottlePersonalization();
  });
  $('#requestButton').addEventListener('click',addToQuote);
  $('#quoteOpen').addEventListener('click',openQuote);
  $('#quoteClose').addEventListener('click',closeQuote);
  $('#sendQuoteButton').addEventListener('click',sendQuote);
  $('#quoteItems').addEventListener('click',event => {
    const button=event.target.closest('[data-remove-quote]');
    if(!button)return;
    quoteItems=quoteItems.filter(item=>item.key!==button.dataset.removeQuote);
    renderQuote();
  });
  $('#quoteModal').addEventListener('click',event => { if(event.target.id==='quoteModal') closeQuote(); });
  $('#modalClose').addEventListener('click',closeCustomizer);
  $('#customModal').addEventListener('click',event => { if(event.target.id==='customModal') closeCustomizer(); });
  document.addEventListener('keydown',event => { if(event.key==='Escape' && $('#customModal').classList.contains('open')) closeCustomizer(); else if(event.key==='Escape' && $('#quoteModal').classList.contains('open')) closeQuote(); });
  $('#menuToggle').addEventListener('click',() => {
    const nav = $('#mainNav');
    const open = nav.classList.toggle('open');
    $('#menuToggle').setAttribute('aria-expanded',String(open));
    $('#menuToggle').textContent = open ? '×' : '☰';
  });
  $('#mainNav').addEventListener('click',event => {
    if (event.target.closest('a') || event.target.closest('#quoteOpen')) {
      $('#mainNav').classList.remove('open');
      $('#menuToggle').setAttribute('aria-expanded','false');
      $('#menuToggle').textContent = '☰';
    }
  });
  loadData();
})();