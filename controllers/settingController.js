import SystemSetting from '../models/SystemSetting.js';

const ANNEXURE_J_KEY = 'annexureJEnabled';

/**
 * Helper — get the current annexureJ setting value (defaults to true if not found)
 */
export const getAnnexureJEnabledValue = async () => {
  const setting = await SystemSetting.findOne({ key: ANNEXURE_J_KEY });
  if (!setting) return true; // default ON
  return setting.value === true || setting.value === 'true';
};

/**
 * GET /api/admin/setting/annexure-j  — Supervisor only
 */
export const getAnnexureJSetting = async (req, res) => {
  try {
    const enabled = await getAnnexureJEnabledValue();
    return res.status(200).json({ success: true, annexureJEnabled: enabled });
  } catch (error) {
    console.error('Error fetching annexureJ setting:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/admin/setting/annexure-j  — Supervisor only
 * Body: { enabled: true | false }
 */
export const setAnnexureJSetting = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: '`enabled` must be a boolean' });
    }

    await SystemSetting.findOneAndUpdate(
      { key: ANNEXURE_J_KEY },
      { key: ANNEXURE_J_KEY, value: enabled, description: 'Enable or disable Annexure J (Part 2) e-sign requirement' },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Annexure J has been ${enabled ? 'enabled' : 'disabled'}`,
      annexureJEnabled: enabled,
    });
  } catch (error) {
    console.error('Error updating annexureJ setting:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/setting/annexure-j-status  — Public (no auth), used by client app
 */
export const getPublicAnnexureJStatus = async (req, res) => {
  try {
    const enabled = await getAnnexureJEnabledValue();
    return res.status(200).json({ success: true, annexureJEnabled: enabled });
  } catch (error) {
    console.error('Error fetching public annexureJ status:', error);
    return res.status(500).json({ success: false, annexureJEnabled: true }); // fail open
  }
};
