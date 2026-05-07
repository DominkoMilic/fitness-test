"use client";
import { useEffect } from "react";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";
import { useAuthStore } from "@/store/useAuthStore";
import { recordCookieAck } from "@/lib/api/codes";

export function CookieBanner() {
  useEffect(() => {
    CookieConsent.run({
      guiOptions: {
        consentModal: {
          layout: "box inline",
          position: "bottom right",
          equalWeightButtons: true,
          flipButtons: false,
        },
        preferencesModal: {
          layout: "box",
          position: "right",
          equalWeightButtons: true,
          flipButtons: false,
        },
      },
      categories: {
        necessary: {
          enabled: true,
          readOnly: true,
        },
      },
      onConsent: () => {
        const userId = useAuthStore.getState().user?.id;
        if (userId) recordCookieAck(userId).catch(() => {});
      },
      language: {
        default: "hr",
        translations: {
          hr: {
            consentModal: {
              title: "Aplikacija koristi nužne kolačiće",
              description:
                'Aplikacija koristi isključivo nužne kolačiće i lokalnu pohranu potrebne za rad (prijava, postavke, povijest pretraga). Ne koristimo marketinške ni analitičke kolačiće. Više u <a href="/pravila-privatnosti">Pravilima privatnosti</a>.',
              acceptAllBtn: "U redu, razumijem",
              showPreferencesBtn: "Više informacija",
            },
            preferencesModal: {
              title: "Postavke kolačića",
              acceptAllBtn: "U redu, razumijem",
              savePreferencesBtn: "Spremi",
              closeIconLabel: "Zatvori",
              sections: [
                {
                  title: "Korištenje kolačića",
                  description:
                    'Aplikacija koristi isključivo nužne (tehničke) kolačiće. Detalje pronađite u <a href="/pravila-privatnosti">Pravilima privatnosti</a>.',
                },
                {
                  title: "Nužni kolačići",
                  description:
                    "Potrebni za rad Aplikacije: prijava pristupnim kodom, lokalno spremanje postavki, rad PWA-a. Ne mogu se isključiti.",
                  linkedCategory: "necessary",
                },
              ],
            },
          },
        },
      },
    });
  }, []);

  return null;
}
