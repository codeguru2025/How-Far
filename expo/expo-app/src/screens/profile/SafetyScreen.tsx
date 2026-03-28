// Safety & Guardians Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export function SafetyScreen({ onNavigate }: Props) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: '1', name: 'Mom', phone: '+263771234567', relationship: 'Parent' },
  ]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelationship, setNewRelationship] = useState('');

  function addContact() {
    if (!newName.trim() || !newPhone.trim()) {
      Alert.alert('Error', 'Please enter name and phone number');
      return;
    }

    const newContact: EmergencyContact = {
      id: Date.now().toString(),
      name: newName.trim(),
      phone: newPhone.trim(),
      relationship: newRelationship.trim() || 'Other',
    };

    setContacts([...contacts, newContact]);
    setNewName('');
    setNewPhone('');
    setNewRelationship('');
    setShowAddForm(false);
    Alert.alert('Success', 'Emergency contact added!');
  }

  function removeContact(id: string) {
    Alert.alert('Remove Contact', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Remove', 
        style: 'destructive',
        onPress: () => setContacts(contacts.filter(c => c.id !== id))
      },
    ]);
  }

  function callEmergency() {
    Linking.openURL('tel:0773665350');
  }

  function whatsAppEmergency() {
    Linking.openURL('https://wa.me/263712171267?text=EMERGENCY: I need help! Please check my location.');
  }

  function shareTrip() {
    // Navigate to live location sharing
    onNavigate('rider-map');
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('profile')} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Emergency Actions */}
        <View style={styles.emergencySection}>
          <TouchableOpacity style={styles.emergencyButton} onPress={callEmergency}>
            <Text style={styles.emergencyIcon}>📞</Text>
            <Text style={styles.emergencyText}>Emergency Call</Text>
            <Text style={styles.emergencyNumber}>0773665350</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.whatsappButton} onPress={whatsAppEmergency}>
            <Text style={styles.shareIcon}>💬</Text>
            <Text style={styles.whatsappText}>WhatsApp SOS</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.emergencySection}>
          <TouchableOpacity style={styles.shareButton} onPress={shareTrip}>
            <Text style={styles.shareIcon}>📍</Text>
            <Text style={styles.shareText}>View Live Location</Text>
          </TouchableOpacity>
        </View>

        {/* Safety Tips */}
        <Text style={styles.sectionTitle}>Safety Tips</Text>
        <View style={styles.tipsCard}>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>✓</Text>
            <Text style={styles.tipText}>Always verify the driver and vehicle before getting in</Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>✓</Text>
            <Text style={styles.tipText}>Share your trip details with a trusted contact</Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>✓</Text>
            <Text style={styles.tipText}>Sit in the back seat when riding alone</Text>
          </View>
          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>✓</Text>
            <Text style={styles.tipText}>Trust your instincts - cancel if something feels wrong</Text>
          </View>
        </View>

        {/* Emergency Contacts */}
        <View style={styles.contactsHeader}>
          <Text style={styles.sectionTitle}>Emergency Contacts</Text>
          <TouchableOpacity onPress={() => setShowAddForm(!showAddForm)}>
            <Text style={styles.addButton}>{showAddForm ? '✕' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>

        {showAddForm && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={newName}
              onChangeText={setNewName}
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
            />
            <TextInput
              style={styles.input}
              placeholder="Relationship (e.g. Parent, Friend)"
              value={newRelationship}
              onChangeText={setNewRelationship}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity style={styles.saveContactButton} onPress={addContact}>
              <Text style={styles.saveContactText}>Add Contact</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.contactsList}>
          {contacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
                <Text style={styles.contactRelationship}>{contact.relationship}</Text>
              </View>
              <TouchableOpacity 
                style={styles.removeButton}
                onPress={() => removeContact(contact.id)}
              >
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          
          {contacts.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No emergency contacts added</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#1E3A5F',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emergencySection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  emergencyButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  emergencyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emergencyText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  emergencyNumber: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#D1FAE5',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  shareText: {
    color: '#2563EB',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  whatsappText: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tipsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tipIcon: {
    color: '#10B981',
    fontWeight: 'bold',
    marginRight: 12,
    fontSize: 16,
  },
  tipText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  contactsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  addForm: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  saveContactButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  saveContactText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contactsList: {
    gap: 12,
  },
  contactCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  contactPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contactRelationship: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  bottomPadding: {
    height: 40,
  },
});

