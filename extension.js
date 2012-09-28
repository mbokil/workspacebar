/* WorkspaceBar Extension
 * author: Mark Bokil
 * 9/16/12
 * version 1.0.1
 * credit: gcampax, some code from Workspace Indicator 
 */

const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Gettext = imports.gettext.domain('markbokil.com-extensions');
const _ = Gettext.gettext;
const _N = function(x) { return x; }

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const Keys = Me.imports.keys;

const DEBUG = false;
const PREFS_DIALOG = 'gnome-shell-extension-prefs workspace-bar@markbokil.com';

function init(extensionMeta)
{
    return new WorkspaceBar(extensionMeta);
}

function WorkspaceBar(extensionMeta)
{
    this.init(extensionMeta);
}

function debug(str) {
    if (DEBUG) {
        str = "[ WorkspaceBar ]--------> " + str;
        global.log(str);
    }
}

WorkspaceBar.prototype = {
    
    init: function(extensionMeta) {
        this.extensionMeta = extensionMeta;
        this._settings = Convenience.getSettings();
    },

    enable: function() {
        this._settingsSignals = [];
        this._settingsSignals.push(this._settings.connect('changed::'+Keys.OVERVIEW_MODE, Lang.bind(this, this._setOverViewMode)));
        this._settingsSignals.push(this._settings.connect('changed::'+Keys.POSITION, Lang.bind(this, this._setPosition)));
        this.overViewMode = this._settings.get_boolean(Keys.OVERVIEW_MODE);
        this.boxPosition = this._settings.get_string(Keys.POSITION);
        this.boxMain = new St.BoxLayout();
        this.boxMain.add_style_class_name("panelBox");
        this.buttonBox = new St.Button();
        this.buttonBox.connect('enter-event', Lang.bind(this, this._showOverView));
        this.buttonBox.add_actor(this.boxMain);
        this.currentWorkSpace = this._getCurrentWorkSpace();

        // add box to panel
        let box = Main.panel["_" + this.boxPosition + "Box"];
        box.insert_child_at_index(this.buttonBox,0);

        this._screenSignals = [];
        this._screenSignals.push(global.screen.connect_after('workspace-removed', Lang.bind(this,this._buildWorkSpaceBtns)));
        this._screenSignals.push(global.screen.connect_after('workspace-added', Lang.bind(this,this._buildWorkSpaceBtns)));
        this._screenSignals.push(global.screen.connect_after('workspace-switched', Lang.bind(this,this._buildWorkSpaceBtns)));
        
        this._buildWorkSpaceBtns();
    },

    disable: function() {
        let box = Main.panel["_" + this.boxPosition + "Box"];
        box.remove_actor(this.buttonBox);
        this.buttonBox = null;

        // disconnect screen signals 
        for (x=0; x < this._screenSignals.length; x++) {
            global.screen.disconnect(this._screenSignals[x]);
        }
        this._screenSignals = [];
        this._screenSignals = null;

        // disconnect settings bindings 
        for (x=0; x < this._settingsSignals.length; x++) {
            global.screen.disconnect(this._settingsSignals[x]);
        }
        this._settingsSignals = [];
        this._settingsSignals = null;
    },

    _doPrefsDialog: function() {
        debug('right-click in onbtnpress: ');
        Main.Util.trySpawnCommandLine(PREFS_DIALOG);
            
    },

    _setOverViewMode: function() {
        if( this._settings.get_boolean(Keys.OVERVIEW_MODE) ) {
            this.overViewMode = true;
        } else {
            this.overViewMode = false;
        }
    },

    _showOverView: function() {
        if (this.overViewMode) {
            if (!Main.overview.visible) {
                Main.overview.show();
            }    
        }   
    },

    _setPosition: function() {
        let oldPosition = this.boxPosition;
        this.boxPosition = this._settings.get_string(Keys.POSITION);

        // remove box
        let box = Main.panel["_" + oldPosition + "Box"];
        box.remove_actor(this.buttonBox);

        // add box
        box = Main.panel["_" + this.boxPosition + "Box"];
        box.insert_child_at_index(this.buttonBox,0);
    },

    _getCurrentWorkSpace: function() {
        return global.screen.get_active_workspace().index();
    },

    _buildWorkSpaceBtns: function() {
        this._removeAllChildren(this.boxMain); //clear box container
        this.currentWorkSpace = this._getCurrentWorkSpace();
        this.buttons = []; //truncate arrays to release memory
        this.labels = [];
        let workSpaces = global.screen.n_workspaces - 1;
        let str = '';

        for (x=0; x <= workSpaces; x++) {
            str =  (x+1).toString();
            if ( x == this.currentWorkSpace) {
                this.labels[x] = new St.Label({ text: _(str), style_class: "activeBtn" });
            } else {
                this.labels[x] = new St.Label({ text: _(str), style_class: "inactiveBtn" });
            }
            
            this.buttons[x] = new St.Button(); //{style_class: "panel-button"}
            this.buttons[x].set_child(this.labels[x]);

            this.buttons[x].connect('button-press-event', Lang.bind(this, function(actor, event) {
                let button = event.get_button();
                if (button == 3) { //right click
                    this._doPrefsDialog();
                } else {
                    this._setWorkSpace(actor.get_child().text); //use text label for workspace index
                }
                }));

            this.buttons[x].connect('scroll-event', Lang.bind(this, this._onScrollEvent));
            this.boxMain.add_actor(this.buttons[x]);
        }
        
    },

    _removeAllChildren: function(box) {
        let children = box.get_children();

        if (children) {
            let len = children.length;

            for(x=len-1; x >= 0  ; x--) {
                box.remove_actor(children[x]);
            }
        }
        
    },

    _setWorkSpace: function(index) {
        index--; //button labels are 1,2,3, off by +1

        try {
            let possibleWorkspace = global.screen.get_workspace_by_index(index);
            possibleWorkspace.activate(global.get_current_time());
        } catch(e) {
            global.logError(e);
            return;
        }

        this._buildWorkSpaceBtns(); //refresh GUI after add,remove,switch workspace
    },

    _activateScroll : function (offSet) {
        this.currentWorkSpace = this._getCurrentWorkSpace() + offSet;
        let workSpaces = global.screen.n_workspaces - 1;

        if (this.currentWorkSpace < 0) this.currentWorkSpace = 0;
        if (this.currentWorkSpace > workSpaces) this.currentWorkSpace = workSpaces;

        this._setWorkSpace(this.currentWorkSpace + 1);
    },

    _onScrollEvent : function(actor, event) {
        let direction = event.get_scroll_direction();
        let offSet = 0;

        if (direction == Clutter.ScrollDirection.DOWN) {
            offSet = 1;
        } else if (direction == Clutter.ScrollDirection.UP) {
            offSet = -1;
        } else {
            return;
        }
       
        this._activateScroll(offSet);
    }
}

