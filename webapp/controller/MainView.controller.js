sap.ui.define([
    "etiqueta/ubicacion/controller/App.controller",
    "sap/ui/core/BusyIndicator",
    "sap/ui/core/Item",
    "sap/m/PDFViewer",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/ValueState"
],
    function (Controller, BusyIndicator, Item, PDFViewer, Filter, FilterOperator, ValueState) {
        "use strict";

        return Controller.extend("etiqueta.ubicacion.controller.MainView", {
            onInit: async function () {
                BusyIndicator.show(0);
                try {
                    const ask = await this._ZZ1_CDS_STORAGE_BINS_Read_Entity();
                    // ✅ ask.OData es el array plano
                    console.log("_ZZ1_CDS_STORAGE_BINS_Read_Entity", ask.OData)
                    this.getOwnerComponent().getModel("LocalModel").setProperty("/Locations", ask.OData);
                } catch (e) {
                    this._DataErrorLoad(e); // e trae el OData error del read()
                } finally {
                    BusyIndicator.hide();
                }

                const oInput = this.byId("MainView_Input_01");
                oInput.setSuggestionRowValidator(this.suggestionRowValidator);
            },


            suggestionRowValidator: function (oColumnListItem) {
                var aCells = oColumnListItem.getCells();

                return new Item({
                    key: aCells[1].getText(),
                    text: aCells[0].getText()
                });
            },
            _cleanFields: function () {
                var oView = this.getView();
                oView.byId("MainView_Input_01").setValue("");
                oView.byId("MainView_Text_05").setText("");
                oView.byId("MainView_Text_06").setText("");
                oView.byId("MainView_Text_07").setText("");
                oView.byId("MainView_Input_01").setValueState("None");
            },
            _CheckData: function () {
                var that = this;
                this.onChangeLocation();
                var oView = this.getView();
                var oLocation = oView.byId("MainView_Input_01");
                var bLocation = oLocation.getValueState() == "None" ? true : false;

                if (bLocation) {
                    var oBody = {
                        WarehouseNumber: that.byId("MainView_Text_05").getText(),
                        StorageBin: that.byId("MainView_Text_06").getText(),
                        StorageType: that.byId("MainView_Text_07").getText()
                    };
                    return oBody;
                } else {
                    return false;
                };
            },
            /* onChangeLocation: function (oEvent) {
                var that = this;
                var oLocation = this.getView().byId("MainView_Input_01");
                if (oLocation.getSelectedKey() == "") {
                    oLocation.setValueState("Error").setValueStateText(that._oResourceBundle().getText("mainview.valueStateText"));
                    oLocation.setValue("");
                } else {
                    oLocation.setValueState("None");
                };
            }, */

            onChangeLocation: function () {
                const sLgnum = this.byId("MainView_Text_05").getText();
                const sLgpla = this.byId("MainView_Text_06").getText();
                const oInput = this.byId("MainView_Input_01");

                if (!sLgnum || !sLgpla) {
                    oInput.setValueState("Error").setValueStateText(this._oResourceBundle().getText("mainview.valueStateText"));
                } else {
                    oInput.setValueState("None");
                }
            },

            onPrintLabelZebra: function () {
                BusyIndicator.show(0);
                var that = this;
                var oBody = that._CheckData();
                if (oBody) {
                    this._zz1_cds_print_loc_lab_Read_Entity(oBody.WarehouseNumber, oBody.StorageBin)
                        .then(function (ask) {
                            if (ask.OData.sent) {
                                that._cleanFields();
                                BusyIndicator.hide();
                                that._DataSuccessPrint(ask.OData);
                            };
                        })
                        .catch(function (ask) {
                            that._cleanFields();
                            BusyIndicator.hide();
                            that._DataErrorPrint(ask.OData);
                        });
                } else {
                    BusyIndicator.hide();
                };
            },
            /* onSuggestionItemSelected: function (oEvent) {
                var that = this;
                if (oEvent.getParameters().selectedRow) {
                    var oCells = oEvent.getParameters().selectedRow.mAggregations.cells;
                    var sWarehouseNumber = oCells[0].mProperties.text;
                    var sStorageBin = oCells[1].mProperties.text;
                    var sStorageType = oCells[2].mProperties.text;

                    this.byId("MainView_Text_05").setText(sWarehouseNumber);
                    this.byId("MainView_Text_06").setText(sStorageBin);
                    this.byId("MainView_Text_07").setText(sStorageType);
                } else {
                    that.onChangeLocation();
                };
            }, */
            onPrintLabel: function () {
                BusyIndicator.show(0);
                var that = this;
                var oBody = that._CheckData();
                if (oBody) {
                    this._PDFBase64(oBody.WarehouseNumber, oBody.StorageBin)
                        .then(function (ask) {
                            if (ask.OData.sent) {
                                that._cleanFields();
                                BusyIndicator.hide();

                                var decodePdfContent = atob(ask.OData.sent);
                                var byteArray = new Uint8Array(decodePdfContent.length);
                                for (var i = 0; i < decodePdfContent.length; i++) {
                                    byteArray[i] = decodePdfContent.charCodeAt(i);
                                }
                                var blob = new Blob([byteArray.buffer], { type: 'application/pdf' });
                                var _pdfurl = URL.createObjectURL(blob);

                                //if (!that._PDFViewer) { // Erick Piña PRD fix - 10-Sept-2025
                                that._PDFViewer = new PDFViewer({
                                    width: "auto",
                                    source: _pdfurl,
                                    isTrustedSource: true,
                                    showDownloadButton: false
                                });
                                jQuery.sap.addUrlWhitelist("blob");
                                //}
                                that._PDFViewer.downloadPDF = function () {
                                    File.save(
                                        byteArray.buffer,
                                        "Etiqueta ubicacion"
                                    );
                                };
                                that._PDFViewer.open();
                            };
                        })
                        .catch(function (ask) {
                            that._cleanFields();
                            BusyIndicator.hide();
                            that._DataErrorPrint(ask.OData);
                        });
                } else {
                    BusyIndicator.hide();
                };
            },


            onSuggest: function (oEvent) {
                const sValue = (oEvent.getParameter("suggestValue") || "").trim();

                const oInput = oEvent.getSource();
                const oBinding = oInput.getBinding("suggestionRows"); // ahora SÍ existe
                if (!oBinding) {
                    // Debug útil si algo falla
                    // console.warn("No binding. Revisa path/model de suggestionRows en la vista.");
                    return;
                }

                if (sValue.length < 2) {
                    oBinding.filter([]);   // limpia
                    return;
                }

                // OR sobre columnas
                const aOr = [
                    new Filter("Lgnum", FilterOperator.Contains, sValue),
                    new Filter("Lgpla", FilterOperator.Contains, sValue),
                    new Filter("Lgtyp", FilterOperator.Contains, sValue)
                ];

                oBinding.filter([new Filter({ filters: aOr, and: false })]);
            },

            onSuggestionItemSelected: function (oEvent) {
                const oRow = oEvent.getParameter("selectedRow");
                if (!oRow) { return; }

                // Usa el MISMO modelo: "ZSB_LOC_LL"
                const oCtx = oRow.getBindingContext("ZSB_LOC_LL");
                const oObj = oCtx.getObject();

                this.getOwnerComponent().getModel("LocalModel").setProperty("/SelectedLocation", {
                    Lgnum: oObj.Lgnum,
                    Lgpla: oObj.Lgpla,
                    Lgtyp: oObj.Lgtyp
                });

                this.byId("MainView_Text_05").setText(oObj.Lgnum);
                this.byId("MainView_Text_06").setText(oObj.Lgpla);
                this.byId("MainView_Text_07").setText(oObj.Lgtyp);
                this.byId("MainView_Input_01").setValueState("None");
            }



        });
    });
