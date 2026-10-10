// Paginate React-rendered DOM, never raw user HTML. Measure at the same A4 size used for print.
export const PAPER_WIDTH = 794
export const PAPER_HEIGHT = 1123
const children = node => Array.from(node.children)
function units(nodes) {
  return nodes.flatMap(node => node.matches('.pv-section')
    ? children(node).filter(child=>!child.matches('.pv-h')).map(item=>({section:node,title:node.querySelector('.pv-h'),item}))
    : [{section:null,item:node}])
}
function splitItem(item) {
  const list = item.matches('ul,.pv-skills,.pv-skills-grid') ? item : item.querySelector('ul,.pv-skills,.pv-skills-grid')
  if (list && list.children.length>1) {
    const a=item.cloneNode(true), b=item.cloneNode(true), selector=list===item?null:'ul,.pv-skills,.pv-skills-grid'
    const left=selector?a.querySelector(selector):a,right=selector?b.querySelector(selector):b
    const middle=Math.ceil(list.children.length/2)
    children(left).slice(middle).forEach(n=>n.remove());children(right).slice(0,middle).forEach(n=>n.remove())
    return [a,b]
  }
  const walker=document.createTreeWalker(item,NodeFilter.SHOW_TEXT),texts=[]
  while(walker.nextNode()) texts.push(walker.currentNode)
  const longest=texts.reduce((best,n)=>n.textContent.length>(best?.textContent.length||0)?n:best,null)
  if (!longest || longest.textContent.length<80) return null
  const index=texts.indexOf(longest), chars=Array.from(longest.textContent), midpoint=Math.ceil(chars.length/2)
  return [chars.slice(0,midpoint).join(''),chars.slice(midpoint).join('')].map(value=>{
    const copy=item.cloneNode(true), walk=document.createTreeWalker(copy,NodeFilter.SHOW_TEXT)
    for(let i=0;i<=index;i++) walk.nextNode()
    walk.currentNode.textContent=value
    return copy
  })
}
export function paginatePreview(source,host) {
  const columnFrame=children(source).find(n=>n.matches('.pv-cols,.pv-main'))
  const headers=children(source).filter(n=>!n.matches('.pv-section,.pv-cols,.pv-main'))
  const flows=columnFrame?children(columnFrame).map(col=>units(children(col))):[units(children(source).filter(n=>n.matches('.pv-section')))]
  const pages=[]
  function pageAt(index) {
    if(pages[index]) return pages[index]
    const root=source.cloneNode(false);root.classList.add('paginated-preview');root.dataset.resumePage=index+1
    if(!index && !source.matches('.pv-layout-sidebar')) headers.forEach(n=>root.append(n.cloneNode(true)))
    let slots
    if(columnFrame) { const frame=columnFrame.cloneNode(false);slots=children(columnFrame).map(col=>{const slot=col.cloneNode(false);frame.append(slot);return slot});root.append(frame) }
    else slots=[root]
    host.append(root);return pages[index]={root,slots}
  }
  flows.forEach((flow,col)=>{
    const queue=[...flow];let pageIndex=0,count=0
    while(queue.length) {
      if (++count>20000) throw new Error('简历内容过长，请精简后预览')
      const page=pageAt(pageIndex),slot=page.slots[col],unit=queue[0]
      const hadContent=!!slot.querySelector('[data-page-unit]')
      let section=unit.section && slot.lastElementChild?.__sourceSection===unit.section ? slot.lastElementChild : null
      let created=false
      if(unit.section && !section) {section=unit.section.cloneNode(false);section.__sourceSection=unit.section;if(unit.title)section.append(unit.title.cloneNode(true));slot.append(section);created=true}
      const node=unit.item.cloneNode(true);node.dataset.pageUnit='true';(section||slot).append(node)
      const rootBottom=page.root.getBoundingClientRect().top+PAPER_HEIGHT
      const limit=rootBottom-parseFloat(getComputedStyle(page.root).paddingBottom)- (slot===page.root?0:parseFloat(getComputedStyle(slot).paddingBottom))
      if(node.getBoundingClientRect().bottom<=limit-1) {queue.shift();continue}
      node.remove();if(created)section.remove()
      if(hadContent) {pageIndex++;continue}
      const parts=splitItem(unit.item)
      if(parts) {queue.splice(0,1,...parts.map(item=>({...unit,item})));continue}
      throw new Error('存在无法分页的内容，请缩短单条信息')
    }
  })
  if(!pages.length) pageAt(0)
  return pages.map(p=>p.root.outerHTML)
}
