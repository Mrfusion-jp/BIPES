"use strict";

import {DOM, Animate, ContextMenu} from '../../base/dom.js'
import {Tool} from '../../base/tool.js'
import {command} from '../../base/command.js'
import {storage} from '../../base/storage.js'

import {project} from '../project/main.js'
import {Actions, Action} from './action.js'
import {DataStorage, DataStorageManager} from './datastorage.js'
import {Charts, Streams, Switches} from './plugins.js'

/* Create dashboard with graphs, streams and buttons */
class Dashboard {
  /* Construct the object, is executed on load of the window. */
  constructor (){
    this.name = 'dashboard'
    this.inited = false
    this.tree               //  Reference to project dashboard tree

    let $ = this._dom = {}
		$.dashboard = new DOM('div', {id:'dashboard'})
		$.grid = new DOM('div', {id:'grid'})
		$.header = new DOM('div', {id:'header'})
		$.storageManager = new DOM('div', {id:'storageManager'})
		$.addMenu = new DOM('div', {id:'addMenu', className:'popup'})

		$.dashboard.append([
		  $.header,
		  $.grid,
		  $.storageManager,
		  $.addMenu
		])
    $.contextMenu = new DOM('div')
    this.contextMenu = new ContextMenu($.contextMenu, this)

    $.section = new DOM(DOM.get('section#dashboard'))
      .append([$.dashboard, $.contextMenu])

		$.add = new DOM('button', {
			className:'icon',
			id:'add',
			title:['NewDashboard']
			})
			.onclick(this, this.add, [true]);
		$.storage = new DOM('button', {
			className:'icon',
			id:'storage',
			title:Msg['EditData']
		  })
		$.gridView = new DOM('button', {
			className:'icon',
			id:'gridView',
			title:Msg['SwitchViewType']
		  })
		  .onclick(this, this.gridView)
		$.addPlugin = new DOM('button', {
			className:'icon',
			id:'add',
			title:Msg['AddWidget']
			})
		$.edit = new DOM('button', {
			className:'icon',
			id:'edit',
			title:Msg['EditDashboard']
			})
			.onclick(this, () => {
			  if ($.dashboard.classList.contains('on')) {
			    $.dashboard.classList.remove('on')
			    this.grid.closeEditor()
			  } else
			    $.dashboard.classList.add('on')
			}, [true]);

		$.tabs = new DOM('span', {id:'tabs'})
		$.wrapper = new DOM('div').append([$.tabs, $.add])
		$.wrapper2 = new DOM('span').append([$.edit, $.gridView, $.storage])
		$.header.append([$.wrapper, $.wrapper2])

		this.grid = new DashboardGrid($.grid, this)
		$.grid.append([$.addPlugin])

		this.storageManager = new DataStorageManager($.storageManager, this.grid, $.storage)

		this.addMenu = new DashboardAddMenu($.addMenu, this.grid, $.addPlugin)

    command.add(this, {
      add: this._add,
      remove: this._remove,
      rename: this._rename
    })
  }
  /*
   * On display page, init the page.
   */
  init (){
    if (this.inited)
      return

    // Check for wrong to array convertiion, reset if so
    if (this.tree instanceof Array)
      this.tree = {}

    if (Object.keys(this.tree).length === 0)
      this.add()
    this.restore()
    this.select(Object.keys(this.tree)[0])
    this.inited = true
  }
  /*
   * On page hidden, deinit the page.
   */
  deinit (){
    if(!this.inited)
      return

    this.unselect()
    this._dom.tabs.removeChilds()
    this.inited = false
  }
  /*
   * On load a project, load the page's scope of the project.
   * @param {Object} obj - Object with the project data in the page's scope
   */
  load (obj){
    if (!obj.hasOwnProperty('tree'))
      return

    let inited = this.inited
    if (this.inited)
      this.deinit()

    this.tree = obj.tree

    if (inited)
      this.init()
  }
  /*
   * Restore DOM navigation buttons.
   */
	restore (){
	  for (const key in this.tree){
      this.include(key, this.tree[key])
    }
	}
	/** Onresize event */
	resize (){
    this.grid.resize()
	}
  /*
   * Return minimal project scope of this page; is called by project when the
   * project does not contain this scope at all.
   */
	empty (){
	  return {tree:{}}
	}
	/*
   * Include include DOM to novigation
   * @param {string} sid - Dashboard's SID.
   * @param {Object} obj - Dashboard scope in the project.
   */
	include (sid, obj){
    let h3 = new DOM('h3', {'innerText':obj.name})

    obj.dom = new DOM('button', {'sid':sid})
	    .append([h3])
      .onevent('contextmenu', this, (ev) => {
        ev.preventDefault()
        this.contextMenu.open([
          {
            id:'rename',
            innerText:Msg['Rename'],
            fun:this.rename,
            args:[sid, obj.name]
          }, {
            id:'remove',
            innerText:Msg['Remove'],
            fun:this.remove,
            args:[sid]
          }
        ], ev)
      }).onclick(this, this.select, [sid])

    let $ = this._dom
    $.tabs.append(obj.dom)
	}
	/** Save to project and refresh tabs with the same dashboard open */
	commit (){
		project.write()
		command.dispatch([this, this.grid], 'update', [
		  this.grid.ref,
		  this.currentSID,
		  project.currentUID
		])
	}
  /**
   * Add dashboard to project
   * @param {boolean} select - If should select after adding.
   */
  add (select){
    let sid = Tool.SID()
    // Apply to all tabs
    command.dispatch(this, 'add', [sid, project.currentUID])
    // Changed by reference, just write to localStorage
    project.write()
    if (select === true)
      this.select(sid)
  }
  /**
   * Add dashboard.
   * @param {string} sid - Dashboard SID.
   * @param {string} projectUID - UID of the project.
   */
  _add (sid, projectUID){
    if (projectUID !== project.currentUID)
      return

    let dash = {
      grid:[],
      name:Msg['Dashboard']
    }
    this.tree[sid] = dash

    // Add DOM.
    if (this.inited)
      this.include(sid, dash)

  }
  /**
   * Remove dashboard from project
   * @param {string} uid - Dashboard SID to remove.
   */
  remove (sid){
    this.contextMenu.close()
    // Apply to all tabs
    command.dispatch(this, 'remove', [sid, project.currentUID])
    // Changed by reference, just write to localStorage
    project.write()
  }
  /**
   * Remove dashboard.
   * @param {string} sid - Workspace SID.
   * @param {string} projectUID - UID of the project.
   */
  _remove (sid, projectUID){
    if (projectUID !== project.currentUID)
      return

    if (this.inited) {
      if (sid === this.currentSID){
        this.unselect()
        if (Object.keys(this.tree).length == 1)
          this.add()
      }

      DOM.get(`[data-sid='${sid}']`, this._dom.tabs).remove()
    }
    delete this.tree[sid]

    if (this.currentSID == undefined)
      this.select(Object.keys(this.tree)[0])
  }
  /**
   * Rename dashboard from project
   * @param {string} sid - Dashboard SID to rename.
   * @param {string} name - New name.
   */
  rename (sid, name){
    this.contextMenu.oninput({
      title:Msg['DashboardName'],
      placeholder:name,
      value:name
    }, (input, ev) => {
      ev.preventDefault()
      let name = input.value

      this.contextMenu.close()

      if (name == undefined || name == '')
        return
      this.tree[sid].name = name
      // Apply to all tabs
      command.dispatch(this, 'rename', [sid, name, project.currentUID])
      // Changed by reference, just write to localStorage
      project.write()
    })
  }
  /**
   * Rename dashboard.
   * @param {string} sid - Workspace SID.
   * @param {string} name - New name.
   * @param {string} projectUID - UID of the project.
   */
  _rename (sid, name, projectUID){
    if (projectUID !== project.currentUID)
      return

    if (this.inited) {
      DOM.get(`[data-sid='${sid}'] h3`, this._dom.tabs).innerText = name
    }
    this.tree[sid].name = name
  }
  /**
   * Select dashboard and init grid
   * @param {string} sid - Dashboard SID to rename.
   */
  select (sid){
    if (this.currentSID !== undefined) {
      this.unselect()
    }
    this.currentSID = sid
    this.grid.init()
    DOM.get(`[data-sid='${sid}']`, this._dom.tabs).classList.add('on')
  }
  /*
   * Unselect the dashboard and deinit grid.
   */
  unselect (){
    this.grid.deinit()
    DOM.get(`[data-sid='${this.currentSID}']`, this._dom.tabs).classList.remove('on')
    this.currentSID = undefined
  }
}

class DashboardGrid {
	constructor (dom, parent){
	  this.parent = parent
	  this.name = 'grid'
	  this.ref              // Reference to the current grid

		this.players = []
		this.charts = []
		this.switches = []
		this.editiding
		this.editingProp  // Store original position and current from plugin(string)
		this.isGrabbing = false;

		let $ = this._dom = {}
		$.grid = dom
		$.actions = new DOM('div', {id:'actions'}).append([
		    new DOM('div', {className:'silk'})
		      .onclick(this, this.closeEditor)
		])
		$.silk = new DOM('div', {id:'silk'})
		  .onclick(this, this.closeEditor)

		$.container = new DOM('div')
		$.grid.append([$.silk, $.container, $.actions])

		this.actions = new Actions($.actions)

		this.muuri = new Muuri($.container._dom, {
		  layoutOnResize: false,
		  dragEnabled: true,
		  layoutOnInit: false,
		  dragHandle: '#grab',
		  dragStartPredicate: (item, e) => {
		    if (this.parent._dom.dashboard.classList.contains('on')){
		      this.isGrabbing = +new Date()
		      return true
		    }
		  }
		  /*dragCssProps: {
        touchAction: 'pan-y',
      }8?
		  /*layout: {
		    alignRight: true
		  }*/
		}).on('dragInit', (item) => {
		  item._element.classList.add('grabbing')
    }).on('dragReleaseEnd', (item) => {
		  item._element.classList.remove('grabbing')
		  if (+new Date () - this.isGrabbing < 150) {
        this.isGrabbing = false
        let obj
        this.ref.forEach(p =>{
          if (p.sid === item._element.dataset.sid)
            obj = p
        })
        this.edit(obj, new DOM(item._element))
    } else
      this.isGrabbing = false
    }).on('move', () => {
	    this.storeLayout()
    })

    // Set & get CSS rule nodes
    document.styleSheets[0].insertRule('section#dashboard .muuri .muuri-item.wide {}', 0)
    document.styleSheets[0].insertRule('section#dashboard .muuri .muuri-item.square {}', 0)
    document.styleSheets[0].insertRule('section#dashboard .muuri .muuri-item.tiny {}', 0)
    this.css = {}
    this.css.muuriWide = document.styleSheets[0].rules[2]
    this.css.muuriSquare = document.styleSheets[0].rules[1]
    this.css.muuriTiny = document.styleSheets[0].rules[0]

    command.add([this.parent, this], {
      update: this._update
    }, true)
	}
  /**
   * Init grid.
   */
  init (){
    this.ref = this.parent.tree[this.parent.currentSID].grid
    this.restore()
  }
  /**
   * Deinit grid.
   */
	deinit (){
		this._dom.grid._dom.classList.remove('on')
		this.editingStream = '';
		setTimeout(() => {this.actions.deinit()},250)

    this.players.forEach((player) => {
      if (player.source == 'DASH')
		    player.destroy()
    })
    this.charts.forEach((chart) => {
      chart.destroy()
    })
    this.muuri.remove(this.muuri.getItems(), {removeElements: true})
		this.players = []
		this.charts = []
    this.ref = undefined
	}
  /**
   * Restore itens.
   */
	restore (){
    this.ref.forEach (item => {
      this.include(item)
    })
    this.restoreLayout()
	}
	/**
	 * Update and refresh grid on change on other tab.
	 * @param {Object} obj - Updated grid.
	 * @param {string} sid - Dashboard's SID.
	 * @param {string} projectUID - Project's UID.
	 */
	_update (obj, sid, projectUID){
	  if (projectUID !== project.currentUID)
	    return

    // Update grid
    this.parent.tree[sid].grid = obj
    // Refresh grid if is open
	  if (sid !== this.parent.currentSID)
	    return

    this.deinit()
    this.init()
	}
  /**
   * Add item from given type.
   * @param {string} type - Item type, like chart or switch.
   */
	add (type){
		let sid = Tool.SID ()
		let obj = {
      sid:sid,
      type:type,
      setup: Actions.defaults(type)
    }
    this.ref.push(obj)
		this.include(obj)
		// Changed locally, save project then dispatch modified
		this.parent.commit()
	}
  /**
   * Include item to grid.
   * @param {Object} data - Object to be included.
   */
	include (data){
    let grab  = new DOM('div', {
      id:'grab',
      title:Msg['DragMe']
    })
    .onevent('contextmenu', this, ()=>{
      if (!this.parent._dom.dashboard.classList.contains('on'))
        this.parent._dom.dashboard.classList.add('on')
    })

    let remove = new DOM('button', {
      className:'button icon notext',
      id:'dismiss',
      title:'Dismiss plugin'
    }).onclick(this, this.remove, [data]);

    let silk = new DOM('div', {className:'silk'})
	  switch (data.type) {
	    case 'chart':
	      console.log('Including chart.js')

	      data.target = new DOM('canvas', {className:'chart'})
		    let content1 = new DOM('div')
			    .append([
			      silk,
			      grab,
				    remove,
				    data.target,
			    ])
			  let container1 = new DOM('div', {sid:data.sid, className:'chart wide'})
			    .append(content1)

		    this.muuri.add(container1._dom)

		    this.charts.push(Charts.chart(data, data.target._dom))

	      silk.onevent('contextmenu', this, ()=>{DOM.switchState(this.parent._dom.dashboard)})
        grab.onclick(this, this.edit, [data, container1])

		    break
	    case 'stream':
		    data.target = new DOM('video', {'preload':'auto','controls':'','autoplay':''})
		    let content2 = new DOM('div')
			    .append([
			      silk,
				    remove,
				    video,
				    drag
			    ])
			  let container2 = new DOM('div', {sid:data.sid, className:'stream'})
			    .append(content2)

		    this.muuri.add(container2._dom)

		    this.players.push (Streams.stream(data.sid, data.target._dom))

        data.target.onclick(this, this.edit, [data.sid, container2]);
		    break
		  case 'switch':
		    data.target = new DOM('span')
		    let content3 = new DOM('div')
			    .append([
				    remove,
				    _switch,
				    drag
			    ])
			  let container3 = new DOM('div', {sid:data.sid, className:'switch'})
			    .append(content3)


		    this.muuri.add(container3._dom)

		    this.switches.push(Switches.switch(data.sid, data.target))

        _switch.onclick(this, this.edit, [data.sid, container3]);
		    break
		  }
  }
  /*
   * Remove a plugin.
   * @param {Object} data - Plugin.
   */
	remove (data){
		console.log(`Removing ${data.sid}`)


		switch (data.type) {
		  case 'stream':
		    this.players.forEach((player, index) => {
			    if (player.sid == data.sid) {
				      if (player.source = 'DASH')
				        player.destroy()
			      this.players.splice(index,1)
			    }
		    })
		    break
		  case 'chart':
		    this.charts.forEach((chart, index) => {
		      if (chart.sid == data.sid){
		        chart.destroy()
		        this.charts.splice(index,1)
		      }
		    })
		    break
		}

		if (this.editingStream == data.sid) {
			this._dom.grid._dom.classList.remove('on')
			this.editingStream = '';
			setTimeout(() => {this.actions.deinit}, 250)
		}

		this.muuri.getItems().forEach((item, index) => {
			if (item._element.dataset.sid == data.sid) {
				this.muuri.remove([item], {removeElements: true})
			}
		})
		this.ref.forEach((item, index) => {
			if (item.sid == data.sid) {
				this.ref.splice(index,1)
			}
		})
		// Changed locally, save project then dispatch modified
		this.parent.commit()
	  if (this.editing)
	    this.closeEditor()
	}
  /*
   * Edit a plugin.
   * @param {Object} obj - Plugin.
   */
	edit (obj, container, ev){
	  if (this.animating || this.isGrabbing)
	    return

    container.id = 'editing'
    this.animating = this.editing = true

	  let transform = container.style.transform
	  let x0 = parseFloat(transform.match(/translateX\(([0-9]+\.?[0-9]*|\.[0-9]+)px\)/)[1]),
	      y0 = parseFloat(transform.match(/translateY\(([0-9]+\.?[0-9]*|\.[0-9]+)px\)/)[1])

	  let w0 = container.width,
	      h0 = container.height
    let w, h, x, y
    if (this._dom.grid.width / 16 > 40){
      w = this._dom.grid.width - (2 + 15)*16,
      h = this._dom.grid.height - 3*16
      x = (this.parent._dom.section.width - w - 15*16) / 2,
      y = (this.parent._dom.section.height - h) / 2 +
          this._dom.grid._dom.scrollTop - (1*16)
    } else {
      w = this._dom.grid.width - (2)*16,
      h = this._dom.grid.height - (3 + 12)*16,
      x = (this.parent._dom.section.width - w) / 2 ,
      y = (this.parent._dom.section.height - h) / 2 +
          this._dom.grid._dom.scrollTop - (1 + 14/2)*16
    }

    let t = 0;
    container.style.zIndex = '2'
    Animate.on(this._dom.grid, 125)
    this.bezier = setInterval(() => {
      let _t = t/15.
      let _b = _t*_t*(3.-2.*_t)
      let _x = (_b * x) + (x0 * (1-_b)),
          _y = (_b * y) + (y0 * (1-_b))
  	  container.style.transform = `translateX(${_x}px) translateY(${_y}px)`
  	  container.style.width = `${w0 + _b*(w - w0)}px`
  	  container.style.height = `${h0 + _b*(h - h0)}px`
      if (t++ === 15)
        clearInterval(this.bezier),
        this.animating = false
    }, 15)

	  console.log(`Editing stream ${obj.sid}`)

	  this.actions.show(obj, this)

	  this.editing = obj
	  this.editingProp = {
	    from:[x0, y0],
	    to:[x,y],
	    size_from:[w0, h0],
	    size_to:[w, h],
	    container:container
	  }

	  this.isGrabbing = false
	}
	/** Closes the editor */
	closeEditor (){
	  if (this.editing === undefined)
	    return

    this.animating = true
    let o = this.editingProp,
        t = 0
    this.bezier2 = setInterval(() => {
      let _t = t/15.
      let _b = _t*_t*(3.-2.*_t)
      let _x = (_b * o.from[0]) + (o.to[0] * (1-_b)),
          _y = (_b * o.from[1]) + (o.to[1 ]* (1-_b))
  	  o.container.style.transform = `translateX(${_x}px) translateY(${_y}px)`
  	  o.container.style.width = `${o.size_to[0] + _b*(o.size_from[0] - o.size_to[0])}px`
  	  o.container.style.height = `${o.size_to[1] + _b*(o.size_from[1] - o.size_to[1])}px`
      if (t++ === 15){
        o.container.style.removeProperty('width')
        o.container.style.removeProperty('height')

        clearInterval(this.bezier2),
        this.animating = false
      }
    }, 15)

    Animate.off(this._dom.grid, ()=>{
      o.container.style.zIndex = '0'
      o.container.id = ''
      this.editing = undefined
	    this.editingProp = undefined
      setTimeout(() => {this.resize()}, 500)
    }, 15)
	}
	/** On resize event, compute plugin resize widths and set actions mode (tall/wide). */
	resize (){
	  if (this.editing) {
      return
    }

    let w = this._dom.container.width

    let width = this._dom.grid.width / 16
    let c = [
      [[w/3,w/6],[w/6,w/6],[w/12,w/12]],
      [[w/2,w/4],[w/4,w/4],[w/8,w/8]],
      [[w/1.5,w/3],[w/3,w/3],[w/6,w/6]],
      [[w/1,w/2],[w/2,w/2],[w/4,w/4]]
    ]
    let i
    if (width > 80)
      i = 0
    else if (width > 60)
      i = 1
    else if (width > 40)
      i = 2
    else
      i = 3

    this.css.muuriWide.style.width = `${c[i][0][0] - 1}px`
    this.css.muuriWide.style.height = `${c[i][0][1]}px`

    this.css.muuriSquare.style.width = `${c[i][1][0] - 1}px`
    this.css.muuriSquare.style.height = `${c[i][1][1]}px`

    this.css.muuriTiny.style.width = `${c[i][2][0] - 1}px`
    this.css.muuriTiny.style.height = `${c[i][2][1]}px`

    if (this._dom.grid.width / 16 > 40){
      this._dom.actions.classList.add('wide')
      this._dom.actions.classList.remove('tall')
    } else {
      this._dom.actions.classList.add('tall')
      this._dom.actions.classList.remove('wide')
    }


    this.muuri.refreshItems().layout()
  }
  /** Store current muuri positions to project */
  storeLayout (){
    let pos = this.muuri.getItems().map((item) => {
      return item.getElement().dataset.sid
    })
    this.ref.forEach((item, index) => {
      item.pos = pos.indexOf(item.sid)
    })
    this.parent.commit()
  }
  /** Restore layout */
  restoreLayout (){
    let current = this.muuri.getItems()
    let pos = current.map((item) => {
      return item.getElement().dataset.sid
    })
    let layout = []
    let i = 0, j = 0
    this.ref.forEach((item, index) => {
      layout[item.pos] = current[pos.indexOf(item.sid)]
    })
    layout = layout.filter(n => n) // Remove undefined items
    this.muuri.sort(layout, {layout:'instant'})
  }
}


class DashboardAddMenu {
  constructor (dom, grid, button){
    this.grid = grid
    this.plugins = {
      chart:'Chart',
      stream:'Stream',
      switch: 'Switch'
    }
    let $ = this._dom = {}
    $.addMenu = dom
    $.addMenu.onclick(this, this.close)
    $.plugins = []

    for (const plugin in this.plugins) {
      $.plugins.push(new DOM('button', {
          value: plugin,
          id:`${plugin}Button`,
          className:'icon',
          innerText: this.plugins[plugin]
        })
        .onclick(grid, grid.add, [plugin]))
    }

    $.wrapper = new DOM('div')
      .append($.plugins)
    $.addMenu.append($.wrapper)

    button.onclick(this, this.open)
  }
  close (e) {
    if (e.target.id == 'addMenu')
      Animate.off(this._dom.addMenu._dom)
  }
  open (){
    Animate.on(this._dom.addMenu._dom)
  }
}

export let dashboard = new Dashboard()


