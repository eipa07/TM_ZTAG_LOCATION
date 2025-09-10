sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
  ],
  function (BaseController, MessageBox) {
    "use strict";

    return BaseController.extend("etiqueta.ubicacion.controller.App", {
      onInit: function () {
      },
      _oResourceBundle: function () {
        return this.getOwnerComponent().getModel("i18n").getResourceBundle();
      },
      _DataErrorLoad: function (oResponseError) {
        var that = this;
        var oError = JSON.parse(oResponseError.responseText).error;
        if (oError.code) {
          MessageBox.error(oError.message.value, {
            title: oResponseError.message + " - " + oResponseError.statusCode + " " + oResponseError.statusText,
            actions: ["Cerrar"],
            emphasizedAction: "Cerrar",
            onClose: function () {
              var oRouter = sap.ui.core.UIComponent.getRouterFor(that);
              oRouter.navTo("RouteNotFound", null, true);
            }
          });
        }
      },
      _DataSuccessPrint: function (oResponseSuccess) {
        var that = this;
        var sMsg = that._oResourceBundle().getText("mainview.textPrinting1", [oResponseSuccess.Lgnum, oResponseSuccess.Lgpla]);
        MessageBox.success(sMsg, {
          icon: MessageBox.Icon.SUCCESS,
          title: that._oResourceBundle().getText("mainview.printing"),
          onClose: function () {
          }
        });
      },
      _DataErrorPrint: function (oResponseError) {
        var that = this;
        var oError = JSON.parse(oResponseError.responseText).error;
        if (oError.code) {
          MessageBox.error(oError.message.value, {
            title: oResponseError.message + " - " + oResponseError.statusCode + " " + oResponseError.statusText,
            actions: ["Cerrar"],
            emphasizedAction: "Cerrar",
            onClose: function () {
            }
          });
        }
      },
      

      // ✅ Helpers genéricos para usar await con oModel.read
      _read: function (oModel, sPath, mParams = {}) {
        return new Promise((resolve, reject) => {
          oModel.read(sPath, {
            ...mParams,
            success: resolve,
            error: reject
          });
        });
      },

      _readCount: async function (oModel, sPath) {
        const count = await this._read(oModel, sPath + "/$count");
        // En OData V2 el count llega como string
        return parseInt(count, 10) || 0;
      },

      // ✅ Lector principal con bloques de 5000 y fallback a __next/$skiptoken
      _ZZ1_CDS_STORAGE_BINS_Read_Entity: async function () {
        const oModel = this.getOwnerComponent().getModel("ZSB_LOC_LL");
        const sPath = "/ZZ1_CDS_STORAGE_BINS";
        const iBlockSize = 5000;
        const aAll = [];

        // 1) Count total
        const iTotal = await this._readCount(oModel, sPath);
        console.log("🔎 Total de registros (Count):", iTotal);

        if (iTotal === 0) {
          return { OData: aAll };
        }

        // 2) Intento con $skip/$top en bloques
        let fetched = 0;
        while (fetched < iTotal) {
          console.log(`📦 Leyendo bloque desde skip=${fetched}, top=${iBlockSize}...`);

          const oData = await this._read(oModel, sPath, {
            urlParameters: {
              "$skip": fetched,
              "$top": iBlockSize
            }
          });

          const aChunk = oData?.results || [];
          aAll.push(...aChunk);
          fetched += aChunk.length;

          console.log(
            `✅ Bloque leído: ${aChunk.length} registros | Acumulados: ${fetched}/${iTotal}`
          );

          // Fallback: si el backend devuelve __next, seguimos con $skiptoken
          if (oData && oData.__next) {
            console.log("⚡ Server-driven paging detectado (__next). Continuando con $skiptoken...");

            let nextUrl = oData.__next;
            while (nextUrl && aAll.length < iTotal) {
              // Obtener $skiptoken de la URL
              const match = /[$]skiptoken=([^&]+)/.exec(nextUrl);
              const skiptoken = match ? decodeURIComponent(match[1]) : null;

              console.log(`📦 Leyendo bloque adicional con $skiptoken... (Acumulados: ${aAll.length}/${iTotal})`);

              const oNext = await this._read(oModel, sPath, {
                urlParameters: {
                  "$top": iBlockSize,
                  ...(skiptoken ? { "$skiptoken": skiptoken } : {})
                }
              });

              const aNextChunk = oNext?.results || [];
              aAll.push(...aNextChunk);

              console.log(
                `✅ Bloque $skiptoken: ${aNextChunk.length} registros | Acumulados: ${aAll.length}/${iTotal}`
              );

              nextUrl = oNext.__next; // continuará mientras exista __next
            }
            break; // ya continuamos con __next; salimos del while principal
          }
        }

        console.log("🎉 Lectura completa. Total final acumulado:", aAll.length);
        return { OData: aAll };
      },




      _zz1_cds_print_loc_lab_Read_Entity: function (sWarehouseNumber, sStorageBin) {
        // This method needed a post method, the back-end opted to use a GET method with two parameters to send the information.
        var that = this;
        return new Promise(function (resolve, reject) {
          var sPath = "/zz1_cds_print_loc_lab(Lgpla='" + sStorageBin + "',Lgnum='" + sWarehouseNumber + "')";
          that.getOwnerComponent().getModel("ZSB_LOC_LL").read(sPath, {
            success: function (data) {
              resolve({ OData: data });
            }.bind(this),
            error: function (error) {
              reject({ OData: error });
            }.bind(this)
          });
        });
      },
      _PDFBase64: function (sWarehouseNumber, sStorageBin) {
        var that = this;
        return new Promise(function (resolve, reject) {
          var sPath = "/PDFBase64(Lgpla='" + sStorageBin + "',Lgnum='" + sWarehouseNumber + "')";
          that.getOwnerComponent().getModel("ZSB_LOC_LL").read(sPath, {
            success: function (data) {
              resolve({ OData: data });
            }.bind(this),
            error: function (error) {
              reject({ OData: error });
            }.bind(this)
          });
        });
      }
    });
  }
);