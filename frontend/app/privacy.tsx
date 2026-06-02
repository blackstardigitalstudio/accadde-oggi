import { ScrollView, View, Text, StyleSheet, Linking, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const UPDATED = "2026-05-30";
const CONTACT = "blackstardigitalstudio@gmail.com";

export default function Privacy() {
  return (
    <SafeAreaView style={styles.c}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.h1}>Privacy Policy — Accadde Oggi</Text>
        <Text style={styles.muted}>Ultimo aggiornamento: {UPDATED}</Text>

        <Text style={styles.p}>
          Questa informativa descrive come l’app “Accadde Oggi” (di seguito “l’App”) tratta
          i dati personali degli utenti. L’App mostra eventi storici quotidiani e offre
          funzioni di personalizzazione.
        </Text>

        <Text style={styles.h2}>1. Dati che raccogliamo</Text>
        <Text style={styles.p}>
          • Dati di registrazione: indirizzo email, nome, lingua e paese.{"\n"}
          • Preferenze d’uso: interessi selezionati, “mi piace”/“non mi piace” e contenuti salvati.{"\n"}
          • Dati tecnici minimi necessari al funzionamento (token di autenticazione).
        </Text>
        <Text style={styles.p}>
          Non raccogliamo dati bancari, posizione precisa, contatti o dati biometrici.
        </Text>

        <Text style={styles.h2}>2. Come usiamo i dati</Text>
        <Text style={styles.p}>
          I dati servono esclusivamente a: creare e gestire l’account, autenticare l’accesso,
          personalizzare il feed di eventi e, se attivate, inviare notifiche. Non vendiamo i
          dati personali a terzi.
        </Text>

        <Text style={styles.h2}>3. Conservazione</Text>
        <Text style={styles.p}>
          I dati sono conservati su un database MongoDB (MongoDB Atlas) e protetti da
          credenziali. Le password sono salvate solo in forma cifrata (hash bcrypt).
        </Text>

        <Text style={styles.h2}>4. Servizi di terze parti</Text>
        <Text style={styles.p}>
          I contenuti storici provengono dalle API pubbliche di Wikipedia/Wikimedia. L’App è
          ospitata su Render. Questi servizi trattano solo i dati tecnici necessari all’erogazione.
        </Text>

        <Text style={styles.h2}>5. I tuoi diritti</Text>
        <Text style={styles.p}>
          Puoi richiedere l’accesso, la rettifica o la cancellazione dei tuoi dati e del tuo
          account scrivendoci. Provvederemo nei tempi previsti dalla normativa applicabile.
        </Text>

        <Text style={styles.h2}>6. Contatti</Text>
        <TouchableOpacity onPress={() => Linking.openURL(`mailto:${CONTACT}`)}>
          <Text style={[styles.p, styles.link]}>{CONTACT}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
        <Text style={styles.madeIn}>Made in Italy 🇮🇹</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#050505" },
  body: { padding: 24, paddingBottom: 60, maxWidth: 760, alignSelf: "center", width: "100%" },
  h1: { color: "#F8F8F6", fontSize: 26, fontWeight: "900", marginBottom: 4 },
  h2: { color: "#E63946", fontSize: 15, fontWeight: "800", letterSpacing: 1, marginTop: 24, marginBottom: 6 },
  muted: { color: "#8A8A86", fontSize: 12, marginBottom: 16 },
  p: { color: "#C9C9C6", fontSize: 15, lineHeight: 23, marginTop: 4 },
  link: { color: "#E63946", fontWeight: "700" },
  madeIn: { color: "#8A8A86", fontSize: 12, fontWeight: "800", letterSpacing: 2, textAlign: "center" },
});
